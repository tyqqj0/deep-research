/**
 * 🎯 TaskPollingStore - 独立的任务轮询状态管理
 * 
 * 职责:
 * 1. 管理活跃任务的轮询状态
 * 2. 使用 zustand persist 实现持久化
 * 3. 提供轮询控制接口（启动/停止/暂停）
 * 4. 统一的任务生命周期管理
 * 
 * 设计原则:
 * - 职责单一：只管理轮询相关状态
 * - 持久化：使用 zustand persist 确保状态恢复
 * - 类型安全：完整的 TypeScript 支持
 * - 与项目一致：遵循项目现有的 store 模式
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient, type BackendTaskResponse } from '@/libs/api';
import { taskPersistService } from '@/libs/task/TaskPersistService';
import { taskRecoveryService } from '@/libs/task/TaskRecoveryService';
import { libraryService } from '@/libs/db/LibraryService';
import type { LibraryItem } from '@/libs/db/schema';
import { toast } from 'sonner';

// 🎯 任务信息接口
export interface TaskInfo {
  taskId: string;
  literatureId: string;
  title: string;
  startTime: Date;
  lastPolled?: Date;
  retryCount?: number;
}

// 🎯 轮询配置
export interface PollingConfig {
  interval: number;           // 轮询间隔（毫秒）
  maxRetries: number;         // 最大重试次数
  maxConcurrent: number;      // 最大并发轮询数
  timeout: number;            // 请求超时时间
  autoStart: boolean;         // 是否自动启动轮询
}

// 🎯 轮询统计信息
export interface PollingStatistics {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalPolls: number;
  averageResponseTime: number;
  uptime: number;
}

// 🎯 任务状态回调
export interface TaskCallbacks {
  onComplete?: (itemId: string, result: 'created' | 'duplicate') => void;
  onError?: (error: Error) => void;
  linkingStrategy?: {
    mode: 'bidirectional' | 'unidirectional' | 'source-to-target';
    sourceItemId?: string;
  };
}

// 🎯 Store 状态接口
interface TaskPollingState {
  // ==================== 核心状态 ====================
  activeTasks: Map<string, TaskInfo>;              // 活跃任务列表
  taskCallbacks: Map<string, TaskCallbacks>;       // 任务回调注册
  
  // ==================== 轮询控制 ====================
  pollingInterval: NodeJS.Timeout | null;          // 轮询定时器
  pollingActive: boolean;                           // 轮询是否激活
  pollingPaused: boolean;                           // 轮询是否暂停
  config: PollingConfig;                            // 轮询配置
  
  // ==================== 统计信息 ====================
  statistics: PollingStatistics;                   // 轮询统计
  lastError: string | null;                        // 最后的错误信息
  startTime: Date | null;                          // 轮询开始时间
}

// 🎯 Store 操作接口
interface TaskPollingActions {
  // ==================== 任务管理 ====================
  addTask: (taskId: string, literatureId: string, title: string, callbacks?: TaskCallbacks) => void;
  removeTask: (taskId: string) => void;
  updateTask: (taskId: string, updates: Partial<TaskInfo>) => void;
  
  // ==================== 轮询控制 ====================
  startPolling: () => void;
  stopPolling: () => void;
  pausePolling: () => void;
  resumePolling: () => void;
  
  // ==================== 恢复机制 ====================
  recoverTasks: (items: LibraryItem[]) => Promise<void>;
  
  // ==================== 配置管理 ====================
  updateConfig: (config: Partial<PollingConfig>) => void;
  resetStatistics: () => void;
  
  // ==================== 状态查询 ====================
  getTaskInfo: (taskId: string) => TaskInfo | null;
  isTaskActive: (taskId: string) => boolean;
  getStatistics: () => PollingStatistics;

  // ==================== 内部方法 ====================
  cleanupOrphanedTasks: () => Promise<void>;
  performPolling: () => Promise<void>;
  handleTaskStatusUpdate: (taskInfo: TaskInfo, response: BackendTaskResponse) => Promise<void>;
  handleTaskCompletion: (taskInfo: TaskInfo, response: BackendTaskResponse) => Promise<void>;
  handleTaskFailure: (taskInfo: TaskInfo, response: BackendTaskResponse) => Promise<void>;
  handleTaskError: (taskInfo: TaskInfo, error: any) => void;
}

// 🎯 默认配置
const DEFAULT_CONFIG: PollingConfig = {
  interval: 3000,         // 3秒轮询间隔
  maxRetries: 3,          // 最大重试3次
  maxConcurrent: 10,      // 最大并发10个任务
  timeout: 30000,         // 30秒超时
  autoStart: true         // 自动启动轮询
};

// 🎯 默认统计信息
const DEFAULT_STATISTICS: PollingStatistics = {
  totalTasks: 0,
  activeTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  totalPolls: 0,
  averageResponseTime: 0,
  uptime: 0
};

/**
 * 🎯 TaskPollingStore - 使用 Zustand + Persist
 */
export const useTaskPollingStore = create<TaskPollingState & TaskPollingActions>()(
  persist(
    (set, get) => ({
      // ==================== 初始状态 ====================
      activeTasks: new Map(),
      taskCallbacks: new Map(),
      pollingInterval: null,
      pollingActive: false,
      pollingPaused: false,
      config: DEFAULT_CONFIG,
      statistics: DEFAULT_STATISTICS,
      lastError: null,
      startTime: null,

      // ==================== 任务管理 ====================
      addTask: (taskId: string, literatureId: string, title: string, callbacks?: TaskCallbacks) => {
        const { activeTasks, taskCallbacks } = get();
        
        // 🆕 添加任务信息
        const newTasks = new Map(activeTasks);
        newTasks.set(taskId, {
          taskId,
          literatureId,
          title,
          startTime: new Date(),
          lastPolled: undefined,
          retryCount: 0
        });

        // 🔗 注册回调
        const newCallbacks = new Map(taskCallbacks);
        if (callbacks) {
          newCallbacks.set(taskId, callbacks);
        }

        set({ 
          activeTasks: newTasks,
          taskCallbacks: newCallbacks,
          statistics: {
            ...get().statistics,
            totalTasks: get().statistics.totalTasks + 1,
            activeTasks: newTasks.size
          }
        });

        // 💾 持久化保存
        taskPersistService.saveTaskState(newTasks);

        console.log(`📋 [TaskPollingStore] Added task: ${taskId} (${title})`);

        // 🚀 自动启动轮询
        if (get().config.autoStart && !get().pollingActive) {
          get().startPolling();
        }
      },

      removeTask: (taskId: string) => {
        const { activeTasks, taskCallbacks } = get();
        
        if (activeTasks.has(taskId)) {
          const newTasks = new Map(activeTasks);
          newTasks.delete(taskId);

          const newCallbacks = new Map(taskCallbacks);
          newCallbacks.delete(taskId);

          set({ 
            activeTasks: newTasks,
            taskCallbacks: newCallbacks,
            statistics: {
              ...get().statistics,
              activeTasks: newTasks.size,
              completedTasks: get().statistics.completedTasks + 1
            }
          });

          // 💾 更新持久化
          taskPersistService.removeTask(taskId);
          taskPersistService.saveTaskState(newTasks);

          console.log(`🗑️ [TaskPollingStore] Removed task: ${taskId}`);

          // 🔌 如果没有活跃任务，停止轮询
          if (newTasks.size === 0 && get().pollingActive) {
            get().stopPolling();
          }
        }
      },

      updateTask: (taskId: string, updates: Partial<TaskInfo>) => {
        const { activeTasks } = get();
        
        if (activeTasks.has(taskId)) {
          const newTasks = new Map(activeTasks);
          const existingTask = newTasks.get(taskId)!;
          
          newTasks.set(taskId, {
            ...existingTask,
            ...updates,
            lastPolled: new Date()
          });

          set({ activeTasks: newTasks });

          // 💾 更新持久化
          taskPersistService.saveTaskState(newTasks);

          console.log(`✏️ [TaskPollingStore] Updated task ${taskId}:`, updates);
        }
      },

      // ==================== 轮询控制 ====================
      startPolling: () => {
        const { pollingActive, pollingInterval, config } = get();

        if (pollingActive || pollingInterval) {
          console.log('🔄 [TaskPollingStore] Polling already active, skipping...');
          return;
        }

        console.log('🚀 [TaskPollingStore] Starting task polling...');

        const interval = setInterval(async () => {
          const { activeTasks, pollingPaused } = get();

          // ⏸️ 检查是否暂停
          if (pollingPaused) {
            return;
          }

          // 📭 没有任务时跳过
          if (activeTasks.size === 0) {
            return;
          }

          // 🧹 清理孤立任务
          await get().cleanupOrphanedTasks();

          // 📊 执行轮询
          await get().performPolling();

        }, config.interval);

        set({
          pollingInterval: interval,
          pollingActive: true,
          startTime: new Date(),
          statistics: {
            ...get().statistics,
            uptime: 0
          }
        });

        console.log(`✅ [TaskPollingStore] Polling started (interval: ${config.interval}ms)`);
      },

      stopPolling: () => {
        const { pollingInterval } = get();

        if (pollingInterval) {
          clearInterval(pollingInterval);
          
          set({
            pollingInterval: null,
            pollingActive: false,
            pollingPaused: false,
            startTime: null
          });

          console.log('🔌 [TaskPollingStore] Polling stopped');
        }
      },

      pausePolling: () => {
        if (get().pollingActive) {
          set({ pollingPaused: true });
          console.log('⏸️ [TaskPollingStore] Polling paused');
        }
      },

      resumePolling: () => {
        if (get().pollingActive && get().pollingPaused) {
          set({ pollingPaused: false });
          console.log('▶️ [TaskPollingStore] Polling resumed');
        }
      },

      // ==================== 恢复机制 ====================
      recoverTasks: async (items: LibraryItem[]) => {
        try {
          console.log('🔄 [TaskPollingStore] Starting task recovery...');
          
          const { tasks, statistics } = await taskRecoveryService.smartRecoverTasks(items);
          
          if (tasks.size > 0) {
            // 🔄 转换为 TaskInfo 格式
            const recoveredTasks = new Map<string, TaskInfo>();
            for (const [taskId, taskData] of tasks.entries()) {
              recoveredTasks.set(taskId, {
                taskId: taskData.taskId,
                literatureId: taskData.literatureId,
                title: taskData.title,
                startTime: taskData.startTime,
                lastPolled: undefined,
                retryCount: 0
              });
            }

            set({ 
              activeTasks: recoveredTasks,
              statistics: {
                ...get().statistics,
                totalTasks: get().statistics.totalTasks + recoveredTasks.size,
                activeTasks: recoveredTasks.size
              }
            });

            console.log(`✅ [TaskPollingStore] Recovered ${recoveredTasks.size} tasks`, statistics);

            // 🚀 启动轮询
            if (get().config.autoStart) {
              get().startPolling();
            }
          }
        } catch (error) {
          console.log('❌ [TaskPollingStore] Task recovery failed:', error);
          set({ lastError: error instanceof Error ? error.message : 'Recovery failed' });
        }
      },

      // ==================== 内部方法 ====================
      cleanupOrphanedTasks: async (): Promise<void> => {
        // 这里可以添加清理逻辑，检查任务对应的文献是否还存在
        // 暂时保持简单实现
      },

      performPolling: async (): Promise<void> => {
        const { activeTasks, config } = get();
        const pollStartTime = Date.now();

        console.log(`🔄 [TaskPollingStore] Starting polling cycle for ${activeTasks.size} active tasks`);

        // 🎯 限制并发轮询数量
        const tasksToProcess = Array.from(activeTasks.values()).slice(0, config.maxConcurrent);
        
        if (tasksToProcess.length === 0) {
          console.log('📭 [TaskPollingStore] No tasks to process');
          return;
        }

        console.log(`🎯 [TaskPollingStore] Processing ${tasksToProcess.length} tasks (max concurrent: ${config.maxConcurrent})`);

        const pollPromises = tasksToProcess.map(async (taskInfo) => {
          const taskStartTime = Date.now();
          try {
            console.log(`📤 [TaskPollingStore] Polling task ${taskInfo.taskId} (${taskInfo.title})`);
            
            const response = await apiClient.getTaskStatus(taskInfo.taskId);
            const taskResponseTime = Date.now() - taskStartTime;
            
            console.log(`📥 [TaskPollingStore] Received response for ${taskInfo.taskId} in ${taskResponseTime}ms:`, {
              execution_status: response.execution_status,
              overall_progress: response.literature_status?.overall_progress,
              current_stage: response.literature_status?.current_stage
            });
            
            // 📊 更新统计
            set({
              statistics: {
                ...get().statistics,
                totalPolls: get().statistics.totalPolls + 1
              }
            });

            // 🔄 处理任务状态更新
            await get().handleTaskStatusUpdate(taskInfo, response);

          } catch (error) {
            const taskResponseTime = Date.now() - taskStartTime;
            console.log(`❌ [TaskPollingStore] Failed to poll task ${taskInfo.taskId} after ${taskResponseTime}ms:`, error);
            
            // 🔁 处理重试逻辑
            get().handleTaskError(taskInfo, error);
          }
        });

        await Promise.allSettled(pollPromises);

        // 📊 更新响应时间统计
        const totalResponseTime = Date.now() - pollStartTime;
        const stats = get().statistics;
        const newAverageResponseTime = stats.totalPolls > 0 
          ? (stats.averageResponseTime * (stats.totalPolls - tasksToProcess.length) + totalResponseTime) / stats.totalPolls
          : totalResponseTime;

        set({
          statistics: {
            ...stats,
            averageResponseTime: newAverageResponseTime
          }
        });

        console.log(`✅ [TaskPollingStore] Polling cycle completed in ${totalResponseTime}ms. Average response time: ${Math.round(newAverageResponseTime)}ms`);
      },

      handleTaskStatusUpdate: async (taskInfo: TaskInfo, response: BackendTaskResponse): Promise<void> => {
        console.log(`🎯 [TaskPollingStore] Processing status update for task ${taskInfo.taskId} (${taskInfo.title})`);
        console.log(`📊 [TaskPollingStore] Response details:`, {
          task_id: response.task_id,
          execution_status: response.execution_status,
          result_type: response.result_type,
          overall_progress: response.literature_status?.overall_progress,
          current_stage: response.literature_status?.current_stage,
          overall_status: response.literature_status?.overall_status,
          // 🔗 URL 验证信息
          url_validation_status: response.url_validation_status,
          url_validation_error: response.url_validation_error
        });

        try {
          // 🎯 更新本地文献项的后端任务状态
          const updateData = {
            backendTask: {
              task_id: response.task_id,
              execution_status: response.execution_status,
              result_type: response.result_type,
              literature_id: response.literature_id,
              literature_status: response.literature_status,
              status: response.status || response.execution_status,
              overall_progress: response.literature_status?.overall_progress || 0,
              current_stage: response.literature_status?.current_stage || '处理中',
              resource_url: response.resource_url,
              error_info: response.error_info,
              // 🔗 保存 URL 验证相关信息
              url_validation_status: response.url_validation_status,
              url_validation_error: response.url_validation_error,
              original_url: response.original_url
            },
            updatedAt: new Date()
          };

          console.log(`💾 [TaskPollingStore] Prepared update data:`, {
            title: taskInfo.title,
            execution_status: updateData.backendTask.execution_status,
            overall_progress: updateData.backendTask.overall_progress,
            // 🔗 URL 验证状态
            url_validation_status: updateData.backendTask.url_validation_status,
            url_validation_error: updateData.backendTask.url_validation_error
          });

          // 🔄 更新本地数据库中的文献项
          await libraryService.updateLibraryItem(taskInfo.literatureId, updateData);
          console.log(`✅ [TaskPollingStore] Successfully updated literature item ${taskInfo.literatureId} in database`);

          // 🎯 处理任务完成或失败
          if (response.execution_status === 'completed' || response.execution_status === 'failed') {
            console.log(`🎯 [TaskPollingStore] Task ${taskInfo.taskId} reached terminal state: ${response.execution_status}`);
            
            // 🗑️ 从活跃任务中移除
            get().removeTask(taskInfo.taskId);
            
            // 📋 处理完成任务的特殊逻辑
            if (response.execution_status === 'completed') {
              await get().handleTaskCompletion(taskInfo, response);
            } else {
              await get().handleTaskFailure(taskInfo, response);
            }

            // 🎯 执行完成回调
            const callbacks = get().taskCallbacks.get(taskInfo.taskId);
            if (callbacks?.onComplete && response.execution_status === 'completed') {
              try {
                console.log(`🔔 [TaskPollingStore] Executing completion callback for ${taskInfo.taskId}`);
                callbacks.onComplete(taskInfo.literatureId, response.result_type as 'created' | 'duplicate');
              } catch (callbackError) {
                console.log('❌ [TaskPollingStore] Callback error:', callbackError);
              }
            }
          } else {
            // 🔄 任务仍在进行中，更新轮询时间
            console.log(`⏳ [TaskPollingStore] Task ${taskInfo.taskId} still in progress (${response.execution_status}), continuing polling...`);
            get().updateTask(taskInfo.taskId, { lastPolled: new Date() });
          }

        } catch (error) {
          console.log(`❌ [TaskPollingStore] Failed to update task status for ${taskInfo.taskId}:`, error);
          get().handleTaskError(taskInfo, error);
        }
      },

      handleTaskCompletion: async (taskInfo: TaskInfo, response: BackendTaskResponse): Promise<void> => {
        console.log(`✅ [TaskPollingStore] Handling task completion for ${taskInfo.taskId}`);
        
        try {
          // 🎯 任务完成后的数据同步处理
          if (response.literature_status?.overall_status === 'completed' && response.literature_id) {
            console.log(`📚 [TaskPollingStore] Literature processing completed, starting data sync for ${taskInfo.title}`);
            
            try {
              // 🔄 从后端获取完整的文献数据
              console.log(`🔄 [TaskPollingStore] Fetching complete literature data for ${response.literature_id}`);
              const literatureData = await apiClient.getLiterature(response.literature_id);
              
              // 🏗️ 构建更新数据，确保数据格式符合 LibraryItemSchema
              const updateData: Partial<LibraryItem> = {
                // 📝 基本信息（处理 null 值）
                title: literatureData.metadata?.title || taskInfo.title,
                authors: literatureData.metadata?.authors?.length > 0 
                  ? literatureData.metadata.authors.map(a => a.name).filter(name => name && name.trim()) 
                  : ['Unknown Author'], // 确保至少有一个作者
                
                // 🔢 数值字段（处理 null 转 undefined）
                year: literatureData.metadata?.year || undefined,
                
                // 📄 可选字符串字段（null 转 undefined）
                abstract: literatureData.metadata?.abstract || undefined,
                doi: literatureData.identifiers?.doi || undefined,
                url: literatureData.content?.pdf_url || literatureData.url || undefined,
                
                // 🔗 保存解析内容
                parsedContent: {
                  extractedText: literatureData.content?.has_grobid_fulltext ? 'Available' : undefined,
                  extractedReferences: Array.isArray(literatureData.references) ? literatureData.references : [],
                  parsedAt: new Date()
                },
                
                // 📝 更新时间
                updatedAt: new Date()
              };
              
              // 🧹 移除所有 undefined 值，让 Zod 使用默认值或跳过可选字段
              Object.keys(updateData).forEach(key => {
                if (updateData[key as keyof typeof updateData] === undefined) {
                  delete updateData[key as keyof typeof updateData];
                }
              });
              
              console.log(`💾 [TaskPollingStore] Prepared update data:`, {
                title: updateData.title,
                authors: updateData.authors,
                year: updateData.year,
                hasAbstract: !!updateData.abstract,
                hasDoi: !!updateData.doi,
                hasUrl: !!updateData.url,
                referencesCount: updateData.parsedContent?.extractedReferences?.length || 0
              });
              
              // 💾 更新本地数据库
              await libraryService.updateLibraryItem(taskInfo.literatureId, updateData);
              
              console.log(`✅ [TaskPollingStore] Successfully synced complete literature data for ${taskInfo.title}`);
              
              // 🎉 显示成功通知
              toast.success(`文献处理完成: ${taskInfo.title}`, {
                description: `已成功处理并同步完整的文献信息，包括元数据和引用`,
                duration: 5000
              });
              
            } catch (syncError) {
              console.log(`❌ [TaskPollingStore] Failed to sync literature data:`, syncError);
              
              // 🚨 即使同步失败，也显示任务完成通知，但提醒用户数据可能不完整
              toast.warning(`文献处理完成: ${taskInfo.title}`, {
                description: `任务已完成，但数据同步失败，文献信息可能不完整`,
                duration: 8000
              });
            }
          } else {
            // 🎯 任务完成但文献处理可能不完整
            console.log(`⚠️ [TaskPollingStore] Task completed but literature status is not complete:`, {
              overall_status: response.literature_status?.overall_status,
              literature_id: response.literature_id
            });
            
            toast.success(`任务完成: ${taskInfo.title}`, {
              description: `处理任务已完成，但可能需要进一步的数据处理`,
              duration: 5000
            });
          }
        } catch (error) {
          console.log(`❌ [TaskPollingStore] Error in completion handler:`, error);
          
          // 🚨 显示错误通知
          toast.error(`处理完成但出现错误: ${taskInfo.title}`, {
            description: `任务已完成，但后续处理出现问题`,
            duration: 8000
          });
        }
      },

      handleTaskFailure: async (taskInfo: TaskInfo, response: BackendTaskResponse): Promise<void> => {
        console.log(`❌ [TaskPollingStore] Handling task failure for ${taskInfo.taskId}`);
        
        try {
          // 🚨 智能错误信息提取
          let errorMessage = 'Unknown error occurred';
          
          // 🎯 优先处理 URL 验证错误
          if (response.url_validation_status === 'failed' && response.url_validation_error) {
            // 直接使用 url_validation_error，它已经包含了完整的错误信息
            errorMessage = response.url_validation_error;
            
            // 📝 记录详细信息到控制台（调试用）
            console.log(`📊 [TaskPollingStore] Task ${taskInfo.taskId} failed with URL validation error: ${errorMessage}`);
            console.log(`🔍 [TaskPollingStore] URL validation details:`, {
              url_validation_status: response.url_validation_status,
              url_validation_error: response.url_validation_error,
              original_url: response.original_url
            });
            
            // 🔗 显示专门的 URL 错误通知
            toast.error(`URL 访问失败: ${taskInfo.title}`, {
              description: errorMessage,
              duration: 10000, // URL 错误可能需要用户检查链接，显示时间稍长
              action: {
                label: "检查链接",
                onClick: () => {
                  if (response.original_url) {
                    navigator.clipboard.writeText(response.original_url);
                    toast.info("链接已复制到剪贴板");
                  }
                }
              }
            });
            
            return; // 🚨 URL 错误处理完毕，直接返回
          }
          
          // 🎯 处理其他类型的错误
          // 🎯 处理 error_info 对象
          if (response.error_info) {
            if (typeof response.error_info === 'string') {
              errorMessage = response.error_info;
            } else if (typeof response.error_info === 'object') {
              // 尝试提取常见的错误字段
              const errorObj = response.error_info as any;
              errorMessage = errorObj.message || 
                            errorObj.error_message || 
                            errorObj.detail || 
                            errorObj.error || 
                            JSON.stringify(response.error_info);
            }
          }
          // 🎯 根据执行状态提供默认错误信息
          else if (response.execution_status === 'failed') {
            if (response.current_stage) {
              errorMessage = `处理失败于阶段: ${response.current_stage}`;
            } else {
              errorMessage = '文献处理失败，请检查DOI是否有效或稍后重试';
            }
          }
          
          // 📝 记录详细信息到控制台（调试用）
          console.log(`📊 [TaskPollingStore] Task ${taskInfo.taskId} failed with message: ${errorMessage}`);
          console.log(`🔍 [TaskPollingStore] Full error details:`, {
            execution_status: response.execution_status,
            error_info: response.error_info,
            current_stage: response.current_stage
          });
          
          // 🔥 显示通用错误通知
          toast.error(`文献处理失败: ${taskInfo.title}`, {
            description: errorMessage,
            duration: 8000
          });

          // 📊 更新失败统计
          set({
            statistics: {
              ...get().statistics,
              failedTasks: get().statistics.failedTasks + 1
            }
          });
        } catch (error) {
          console.log(`❌ [TaskPollingStore] Error in failure handler:`, error);
        }
      },

      handleTaskError: (taskInfo: TaskInfo, error: any): void => {
        const currentRetries = taskInfo.retryCount || 0;
        
        if (currentRetries < get().config.maxRetries) {
          // 🔁 重试
          get().updateTask(taskInfo.taskId, { retryCount: currentRetries + 1 });
        } else {
          // 🚨 达到最大重试次数，移除任务
          get().removeTask(taskInfo.taskId);
          
          set({
            statistics: {
              ...get().statistics,
              failedTasks: get().statistics.failedTasks + 1
            }
          });

          toast.error(`Task ${taskInfo.taskId} failed after ${get().config.maxRetries} retries`);
        }
      },

      // ==================== 配置管理 ====================
      updateConfig: (newConfig: Partial<PollingConfig>) => {
        const currentConfig = get().config;
        const updatedConfig = { ...currentConfig, ...newConfig };
        
        set({ config: updatedConfig });
        
        // 🔄 如果间隔改变且正在轮询，重启轮询
        if (newConfig.interval && get().pollingActive) {
          get().stopPolling();
          get().startPolling();
        }
      },

      resetStatistics: () => {
        set({ statistics: DEFAULT_STATISTICS });
      },

      // ==================== 状态查询 ====================
      getTaskInfo: (taskId: string) => {
        return get().activeTasks.get(taskId) || null;
      },

      isTaskActive: (taskId: string) => {
        return get().activeTasks.has(taskId);
      },

      getStatistics: () => {
        const stats = get().statistics;
        const startTime = get().startTime;
        
        if (startTime) {
          const uptime = Date.now() - startTime.getTime();
          return { ...stats, uptime };
        }
        
        return stats;
      }
    }),
    {
      name: 'task-polling-store',
      // 🎯 只持久化必要的状态
      partialize: (state) => ({
        config: state.config,
        statistics: state.statistics
        // 注意：activeTasks 通过 TaskPersistService 单独管理
      }),
      // 🔄 恢复时的处理
      onRehydrate: (state) => {
        if (state) {
          // 重置运行时状态
          state.pollingInterval = null;
          state.pollingActive = false;
          state.pollingPaused = false;
          state.activeTasks = new Map();
          state.taskCallbacks = new Map();
          state.startTime = null;
          state.lastError = null;
        }
      }
    }
  )
);