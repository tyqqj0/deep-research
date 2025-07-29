/**
 * 🎯 TaskStateManager - 统一任务状态管理服务 (重构版)
 * 
 * 核心职责:
 * 1. 统一的任务状态计算和显示逻辑
 * 2. 协调各个任务服务的工作
 * 3. 提供标准化的状态显示接口
 * 4. 作为任务管理的门面（Facade）
 * 
 * 设计原则:
 * - 门面模式：协调底层服务，提供简化接口
 * - 无UI依赖：纯业务逻辑服务
 * - 状态标准化：统一的显示状态格式
 * - 服务协调：统一管理各个任务相关服务
 */

import type { LibraryItem, BackendTask } from '@/libs/db/schema';
import { taskPersistService } from './TaskPersistService';
import { taskRecoveryService } from './TaskRecoveryService';

// 🎯 标准化的任务显示状态
export interface TaskDisplayState {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'url_failed';
  label: string;
  description: string;
  progress: number; // 0-100
  animated: boolean;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
  showUploadButton: boolean;
}

// 🔄 重新导出类型（从 TaskPersistService）
export type { PersistedTaskInfo } from './TaskPersistService';

// 📊 进度信息
export interface ProgressInfo {
  percentage: number;
  stage: string;
  estimated?: string;
}

// 🎨 状态配置映射
const STATUS_CONFIGS: Record<TaskDisplayState['status'], Omit<TaskDisplayState, 'progress' | 'description'>> = {
  idle: {
    status: 'idle',
    label: 'Ready',
    animated: false,
    variant: 'outline',
    color: 'bg-gray-50 text-gray-600 border-gray-200',
    showUploadButton: false
  },
  pending: {
    status: 'pending',
    label: 'Pending',
    animated: false,
    variant: 'outline',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    showUploadButton: false
  },
  processing: {
    status: 'processing',
    label: 'Processing',
    animated: true,
    variant: 'outline',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    showUploadButton: false
  },
  completed: {
    status: 'completed',
    label: 'Completed',
    animated: false,
    variant: 'outline',
    color: 'bg-green-100 text-green-800 border-green-300',
    showUploadButton: false
  },
  failed: {
    status: 'failed',
    label: 'Failed',
    animated: false,
    variant: 'destructive',
    color: 'bg-red-100 text-red-800 border-red-300',
    showUploadButton: true
  },
  url_failed: {
    status: 'url_failed',
    label: 'URL Error',
    animated: false,
    variant: 'outline',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    showUploadButton: false
  }
};

export class TaskStateManager {
  private static instance: TaskStateManager;

  private constructor() {}

  public static getInstance(): TaskStateManager {
    if (!TaskStateManager.instance) {
      TaskStateManager.instance = new TaskStateManager();
    }
    return TaskStateManager.instance;
  }

  /**
   * 🎯 核心方法：获取文献项的标准化显示状态
   */
  public getTaskDisplayState(item: LibraryItem): TaskDisplayState {
    const backendTask = item.backendTask;
    
    // 🔍 没有后端任务 = 空闲状态
    if (!backendTask) {
      return {
        ...STATUS_CONFIGS.idle,
        progress: 0,
        description: 'No processing task assigned'
      };
    }

    // 🔗 优先检查URL验证状态
    if (backendTask.url_validation_status === 'failed') {
      const originalUrl = backendTask.original_url || '';
      const errorMsg = backendTask.url_validation_error || 'URL validation failed';
      
      return {
        ...STATUS_CONFIGS.url_failed,
        progress: 0,
        description: `${errorMsg}${originalUrl ? `\nOriginal URL: ${originalUrl}` : ''}`
      };
    }

    // 📊 根据执行状态返回相应配置
    const executionStatus = backendTask.execution_status || 'pending';
    const progress = backendTask.overall_progress || 0;
    const currentStage = backendTask.current_stage || STATUS_CONFIGS[executionStatus]?.label || 'Unknown';

    switch (executionStatus) {
      case 'pending':
        return {
          ...STATUS_CONFIGS.pending,
          progress,
          description: `Task is waiting to be processed (${Math.round(progress)}% complete)`
        };

      case 'processing':
        return {
          ...STATUS_CONFIGS.processing,
          progress,
          description: `${currentStage} (${Math.round(progress)}% complete)`
        };

      case 'completed':
        return {
          ...STATUS_CONFIGS.completed,
          progress: 100,
          description: 'Task has been completed successfully'
        };

      case 'failed':
        return {
          ...STATUS_CONFIGS.failed,
          progress,
          description: backendTask.error_info ? 
            `Task failed: ${JSON.stringify(backendTask.error_info)}` : 
            'Task processing failed'
        };

      default:
        console.warn(`Unknown execution status: ${executionStatus}`);
        return {
          ...STATUS_CONFIGS.idle,
          progress,
          description: `Unknown status: ${executionStatus}`
        };
    }
  }

  /**
   * 🔍 判断任务是否已完成（包括终止状态）
   */
  public isTaskCompleted(item: LibraryItem): boolean {
    if (!item.backendTask) {
      return true; // 没有后端任务认为是已完成的手动项目
    }

    const { execution_status, url_validation_status, literature_status } = item.backendTask;
    
    // 🔗 URL验证失败 = 任务终止（视为已完成，不再轮询）
    if (url_validation_status === 'failed') {
      return true;
    }
    
    // 🚫 任务执行失败 = 任务终止（视为已完成，不再轮询）
    if (execution_status === 'failed') {
      return true;
    }
    
    // ✅ 任务正常完成
    if (execution_status === 'completed') {
      return true;
    }
    
    // 检查文献状态
    if (literature_status?.overall_status === 'completed') {
      return true;
    }

    return false; // 其他状态（pending, processing）视为未完成
  }

  /**
   * 🔄 判断是否应该显示为处理中状态
   */
  public shouldShowAsProcessing(item: LibraryItem): boolean {
    if (!item.backendTask) {
      return false;
    }

    const { execution_status, url_validation_status } = item.backendTask;
    
    // 🔗 URL验证失败不应该显示为处理中
    if (url_validation_status === 'failed') {
      return false;
    }
    
    // 🚫 执行失败不应该显示为处理中
    if (execution_status === 'failed') {
      return false;
    }

    // 只有真正的处理中状态才显示为处理中
    return execution_status === 'processing' || execution_status === 'pending';
  }

  /**
   * 📊 获取进度信息
   */
  public getProgressInfo(item: LibraryItem): ProgressInfo {
    const backendTask = item.backendTask;
    
    if (!backendTask) {
      return {
        percentage: 0,
        stage: 'No task'
      };
    }

    return {
      percentage: backendTask.overall_progress || 0,
      stage: backendTask.current_stage || 'Unknown',
      estimated: undefined // 可以根据需要添加预估时间
    };
  }

  // ==================== 🎯 门面方法：委托给专门服务 ====================

  /**
   * 🚀 智能恢复任务（委托给 TaskRecoveryService）
   */
  public async smartRecoverTasks(items: LibraryItem[]): Promise<Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>> {
    const { tasks } = await taskRecoveryService.smartRecoverTasks(items);
    return tasks;
  }

  /**
   * 💾 持久化任务状态（委托给 TaskPersistService）
   */
  public persistActiveTasks(tasks: Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>): void {
    taskPersistService.saveTaskState(tasks);
  }

  /**
   * 🗑️ 移除已完成的任务（委托给 TaskPersistService）
   */
  public removeCompletedTask(taskId: string): void {
    taskPersistService.removeTask(taskId);
  }

  /**
   * 🧹 清理所有持久化任务（委托给 TaskPersistService）
   */
  public clearPersistedTasks(): void {
    taskPersistService.clearAllData();
  }
}

// 🎯 导出单例实例
export const taskStateManager = TaskStateManager.getInstance();