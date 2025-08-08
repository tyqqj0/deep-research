/**
 * 🔄 SyncService - 后端状态同步服务
 * 
 * 🎯 核心职责:
 * - 轮询后端任务状态并更新本地数据库
 * - 将后端文献数据同步到本地LibraryItem
 * - 管理多个任务的并发轮询
 * - 提供进度回调和错误处理
 * 
 * 🔄 工作流程:
 * 1. startPolling() - 开始轮询指定任务
 * 2. 定期调用后端API获取状态更新
 * 3. 更新本地数据库中的状态信息
 * 4. 任务完成时同步最终数据
 * 5. 清理轮询资源
 */

import { backendLiteratureService, TaskStatus, BackendLiterature } from './BackendLiteratureService';
import { libraryService } from '../db/LibraryService';
import { LibraryItem } from '../db';

/**
 * 轮询配置
 */
interface PollingConfig {
  interval: number;      // 轮询间隔（毫秒）
  maxAttempts: number;   // 最大轮询次数
  timeout: number;       // 总超时时间（毫秒）
}

/**
 * 进度回调函数类型
 */
export type ProgressCallback = (progress: {
  taskId: string;
  itemId: string;
  overall_status: string;
  components: TaskStatus['components'];
}) => void;

/**
 * 错误回调函数类型
 */
export type ErrorCallback = (error: {
  taskId: string;
  itemId: string;
  message: string;
  details?: any;
}) => void;

/**
 * 轮询任务信息
 */
interface PollingTask {
  taskId: string;
  itemId: string;
  intervalId: NodeJS.Timeout;
  startTime: number;
  attempts: number;
  onProgress?: ProgressCallback;
  onError?: ErrorCallback;
}

export class SyncService {
  private config: PollingConfig;
  private activeTasks: Map<string, PollingTask> = new Map();

  constructor(config?: Partial<PollingConfig>) {
    this.config = {
      interval: 3000,      // 3秒轮询一次
      maxAttempts: 200,    // 最多轮询200次（10分钟）
      timeout: 600000,     // 10分钟总超时
      ...config
    };
  }

  /**
   * 🚀 开始轮询任务状态
   * 
   * @param taskId - 后端任务ID
   * @param itemId - 本地文献条目ID
   * @param onProgress - 进度回调函数
   * @param onError - 错误回调函数
   */
  async startPolling(
    taskId: string, 
    itemId: string, 
    onProgress?: ProgressCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    // 如果已经在轮询这个任务，先停止
    if (this.activeTasks.has(taskId)) {
      this.stopPolling(taskId);
    }

    console.log(`[SyncService] Starting polling for task ${taskId} (item: ${itemId})`);

    const task: PollingTask = {
      taskId,
      itemId,
      intervalId: null as any,
      startTime: Date.now(),
      attempts: 0,
      onProgress,
      onError
    };

    // 立即执行一次状态检查
    await this.pollOnce(task);

    // 设置定期轮询
    task.intervalId = setInterval(async () => {
      await this.pollOnce(task);
    }, this.config.interval);

    this.activeTasks.set(taskId, task);

    // 设置总超时
    setTimeout(() => {
      if (this.activeTasks.has(taskId)) {
        this.handleTimeout(task);
      }
    }, this.config.timeout);
  }

  /**
   * 🛑 停止轮询指定任务
   * 
   * @param taskId - 任务ID
   */
  stopPolling(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (task) {
      clearInterval(task.intervalId);
      this.activeTasks.delete(taskId);
      console.log(`[SyncService] Stopped polling for task ${taskId}`);
    }
  }

  /**
   * 🛑 停止所有轮询任务
   */
  stopAllPolling(): void {
    for (const taskId of this.activeTasks.keys()) {
      this.stopPolling(taskId);
    }
  }

  /**
   * 📊 获取当前活跃的轮询任务数量
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * 🔄 执行一次状态轮询
   */
  private async pollOnce(task: PollingTask): Promise<void> {
    try {
      task.attempts++;

      // 检查是否超过最大尝试次数
      if (task.attempts > this.config.maxAttempts) {
        this.handleMaxAttemptsReached(task);
        return;
      }

      // 获取任务状态
      const status = await backendLiteratureService.getTaskStatus(task.taskId);
      
      // 更新本地数据库状态
      await this.updateLocalStatus(task.itemId, status);

      // 调用进度回调
      if (task.onProgress) {
        task.onProgress({
          taskId: task.taskId,
          itemId: task.itemId,
          overall_status: status.overall_status,
          components: status.components
        });
      }

      // 检查是否完成
      if (status.overall_status === 'success' || status.overall_status === 'partial_success') {
        await this.handleTaskSuccess(task, status);
      } else if (status.overall_status === 'failed') {
        await this.handleTaskFailure(task, status);
      }

    } catch (error) {
      console.error(`[SyncService] Error polling task ${task.taskId}:`, error);
      
      // 调用错误回调
      if (task.onError) {
        task.onError({
          taskId: task.taskId,
          itemId: task.itemId,
          message: error instanceof Error ? error.message : 'Unknown polling error',
          details: error
        });
      }
    }
  }

  /**
   * ✅ 处理任务成功完成
   */
  private async handleTaskSuccess(task: PollingTask, status: TaskStatus): Promise<void> {
    console.log(`[SyncService] Task ${task.taskId} completed successfully`);

    try {
      // 如果有literature_id，获取最终数据
      if (status.literature_id) {
        const literatureData = await backendLiteratureService.getLiterature(status.literature_id);
        await this.syncToLocal(task.itemId, literatureData, status);
      }

      // 更新最终状态
      await libraryService.updateLibraryItem(task.itemId, {
        parsingStatus: status.overall_status === 'success' ? 'SUCCESS' : 'PARTIAL_SUCCESS',
        backendLiteratureId: status.literature_id
      });

    } catch (error) {
      console.error(`[SyncService] Error handling task success:`, error);
    } finally {
      this.stopPolling(task.taskId);
    }
  }

  /**
   * ❌ 处理任务失败
   */
  private async handleTaskFailure(task: PollingTask, status: TaskStatus): Promise<void> {
    console.log(`[SyncService] Task ${task.taskId} failed:`, status.error_info?.error_message);

    try {
      await libraryService.updateLibraryItem(task.itemId, {
        parsingStatus: 'FAILED'
      });

      if (task.onError) {
        task.onError({
          taskId: task.taskId,
          itemId: task.itemId,
          message: status.error_info?.error_message || 'Task failed',
          details: status.error_info
        });
      }

    } catch (error) {
      console.error(`[SyncService] Error handling task failure:`, error);
    } finally {
      this.stopPolling(task.taskId);
    }
  }

  /**
   * ⏰ 处理轮询超时
   */
  private async handleTimeout(task: PollingTask): Promise<void> {
    console.warn(`[SyncService] Task ${task.taskId} polling timeout after ${this.config.timeout}ms`);

    try {
      await libraryService.updateLibraryItem(task.itemId, {
        parsingStatus: 'FAILED'
      });

      if (task.onError) {
        task.onError({
          taskId: task.taskId,
          itemId: task.itemId,
          message: `Polling timeout after ${this.config.timeout / 1000} seconds`
        });
      }

    } catch (error) {
      console.error(`[SyncService] Error handling timeout:`, error);
    } finally {
      this.stopPolling(task.taskId);
    }
  }

  /**
   * 🔢 处理达到最大尝试次数
   */
  private async handleMaxAttemptsReached(task: PollingTask): Promise<void> {
    console.warn(`[SyncService] Task ${task.taskId} reached max attempts (${this.config.maxAttempts})`);

    try {
      await libraryService.updateLibraryItem(task.itemId, {
        parsingStatus: 'FAILED'
      });

      if (task.onError) {
        task.onError({
          taskId: task.taskId,
          itemId: task.itemId,
          message: `Reached maximum polling attempts (${this.config.maxAttempts})`
        });
      }

    } catch (error) {
      console.error(`[SyncService] Error handling max attempts:`, error);
    } finally {
      this.stopPolling(task.taskId);
    }
  }

  /**
   * 📝 更新本地状态
   */
  private async updateLocalStatus(itemId: string, status: TaskStatus): Promise<void> {
    try {
      await libraryService.updateLibraryItem(itemId, {
        parsingStatus: 'PROCESSING',
        backendStatus: {
          overall_status: status.overall_status,
          components: status.components
        }
      });
    } catch (error) {
      console.error(`[SyncService] Error updating local status:`, error);
    }
  }

  /**
   * 🔄 将后端数据同步到本地
   */
  private async syncToLocal(itemId: string, backendData: BackendLiterature, status: TaskStatus): Promise<void> {
    try {
      console.log(`[SyncService] Syncing backend data to local item ${itemId}`);

      // 转换后端数据为本地格式
      const updateData: Partial<LibraryItem> = {
        title: backendData.metadata.title,
        authors: backendData.metadata.authors.map(a => a.name),
        year: backendData.metadata.year,
        abstract: backendData.metadata.abstract,
        doi: backendData.identifiers.doi,
        url: backendData.content.pdf_url || backendData.content.source_page_url,
        
        // 保存解析内容
        parsedContent: {
          extractedText: backendData.content.full_text,
          extractedMetadata: backendData.metadata,
          extractedReferences: backendData.references,
          parsedAt: new Date()
        },

        // 更新时间
        updatedAt: new Date()
      };

      await libraryService.updateLibraryItem(itemId, updateData);
      console.log(`[SyncService] Successfully synced data for item ${itemId}`);

    } catch (error) {
      console.error(`[SyncService] Error syncing to local:`, error);
      throw error;
    }
  }
}

// 导出单例实例
export const syncService = new SyncService();
