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
          console.error('❌ [TaskPollingStore] Task recovery failed:', error);
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

        // 🎯 限制并发轮询数量
        const tasksToProcess = Array.from(activeTasks.values()).slice(0, config.maxConcurrent);

        const pollPromises = tasksToProcess.map(async (taskInfo) => {
          try {
            const response = await apiClient.getTaskStatus(taskInfo.taskId);
            
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
            console.error(`❌ [TaskPollingStore] Failed to poll task ${taskInfo.taskId}:`, error);
            
            // 🔁 处理重试逻辑
            get().handleTaskError(taskInfo, error);
          }
        });

        await Promise.allSettled(pollPromises);

        // 📊 更新响应时间统计
        const responseTime = Date.now() - pollStartTime;
        const stats = get().statistics;
        const newAverageResponseTime = stats.totalPolls > 0 
          ? (stats.averageResponseTime * (stats.totalPolls - tasksToProcess.length) + responseTime) / stats.totalPolls
          : responseTime;

        set({
          statistics: {
            ...stats,
            averageResponseTime: newAverageResponseTime
          }
        });
      },

      handleTaskStatusUpdate: async (taskInfo: TaskInfo, response: BackendTaskResponse): Promise<void> => {
        // 🔄 这里集成原来 libraryStore 中的任务处理逻辑
        // 暂时保持简单实现，后续可以注入处理器
        if (response.execution_status === 'completed' || response.execution_status === 'failed') {
          get().removeTask(taskInfo.taskId);
          
          // 🎯 执行完成回调
          const callbacks = get().taskCallbacks.get(taskInfo.taskId);
          if (callbacks?.onComplete && response.execution_status === 'completed') {
            try {
              callbacks.onComplete(taskInfo.literatureId, response.result_type as 'created' | 'duplicate');
            } catch (callbackError) {
              console.error('❌ [TaskPollingStore] Callback error:', callbackError);
            }
          }
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