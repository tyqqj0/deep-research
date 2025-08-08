/**
 * 🎯 TaskPersistService - 任务持久化服务
 * 
 * 职责:
 * 1. 使用 Zod Schema 验证持久化数据
 * 2. 统一的持久化接口，与项目其他 store 保持一致
 * 3. 版本控制和数据迁移支持
 * 4. 错误处理和数据恢复机制
 * 
 * 设计原则:
 * - 类型安全：所有持久化数据使用 Zod 验证
 * - 一致性：与项目现有 persist 模式保持一致
 * - 可靠性：数据验证和错误恢复机制
 * - 可扩展：支持数据结构版本升级
 */

import { z } from 'zod';

// 🎯 持久化任务信息的 Zod Schema
export const PersistedTaskInfoSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  literatureId: z.string().uuid('Literature ID must be a valid UUID'),
  title: z.string().min(1, 'Title is required'),
  startTime: z.string().datetime('Start time must be a valid ISO datetime'),
  lastPolled: z.string().datetime('Last polled time must be a valid ISO datetime'),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  retryCount: z.number().int().min(0).max(3).default(0) // 重试次数
});

// 🎯 持久化任务状态集合的 Zod Schema
export const PersistedTaskStateSchema = z.object({
  version: z.number().int().positive().default(1), // 数据结构版本
  tasks: z.array(PersistedTaskInfoSchema),
  metadata: z.object({
    lastUpdate: z.string().datetime(),
    totalTasks: z.number().int().min(0),
    activePollingCount: z.number().int().min(0)
  }),
  settings: z.object({
    maxRetries: z.number().int().min(0).max(5).default(3),
    pollingInterval: z.number().int().min(1000).max(30000).default(3000), // 轮询间隔（毫秒）
    maxConcurrentTasks: z.number().int().min(1).max(20).default(10)
  }).optional()
});

// 🎯 导出类型定义
export type PersistedTaskInfo = z.infer<typeof PersistedTaskInfoSchema>;
export type PersistedTaskState = z.infer<typeof PersistedTaskStateSchema>;

// 🎯 数据迁移接口
interface DataMigration {
  version: number;
  migrate: (oldData: any) => any;
}

/**
 * 🎯 TaskPersistService - 任务持久化服务类
 */
export class TaskPersistService {
  private static instance: TaskPersistService;
  private readonly STORAGE_KEY = 'literature-task-state';
  private readonly CURRENT_VERSION = 1;

  // 🔄 数据迁移定义
  private readonly migrations: DataMigration[] = [
    {
      version: 1,
      migrate: (oldData: any) => {
        // 从简单的数组结构迁移到完整的状态结构
        if (Array.isArray(oldData)) {
          return {
            version: 1,
            tasks: oldData.map((task: any) => ({
              ...task,
              retryCount: 0,
              status: task.status || 'processing'
            })),
            metadata: {
              lastUpdate: new Date().toISOString(),
              totalTasks: oldData.length,
              activePollingCount: oldData.length
            }
          };
        }
        return oldData;
      }
    }
  ];

  private constructor() {}

  public static getInstance(): TaskPersistService {
    if (!TaskPersistService.instance) {
      TaskPersistService.instance = new TaskPersistService();
    }
    return TaskPersistService.instance;
  }

  /**
   * 💾 保存任务状态到持久化存储
   */
  public saveTaskState(tasks: Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>): void {
    try {
      const persistedTasks: PersistedTaskInfo[] = [];
      
      for (const [taskId, taskInfo] of tasks.entries()) {
        const persistedTask: PersistedTaskInfo = {
          taskId: taskInfo.taskId,
          literatureId: taskInfo.literatureId,
          title: taskInfo.title,
          startTime: taskInfo.startTime.toISOString(),
          lastPolled: new Date().toISOString(),
          status: 'processing', // 默认状态
          retryCount: 0
        };

        // 🎯 验证数据
        const validatedTask = PersistedTaskInfoSchema.parse(persistedTask);
        persistedTasks.push(validatedTask);
      }

      const taskState: PersistedTaskState = {
        version: this.CURRENT_VERSION,
        tasks: persistedTasks,
        metadata: {
          lastUpdate: new Date().toISOString(),
          totalTasks: persistedTasks.length,
          activePollingCount: persistedTasks.length
        },
        settings: {
          maxRetries: 3,
          pollingInterval: 3000,
          maxConcurrentTasks: 10
        }
      };

      // 🎯 验证完整状态
      const validatedState = PersistedTaskStateSchema.parse(taskState);
      
      // 💾 保存到 localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validatedState));
      console.log(`💾 [TaskPersistService] Saved ${persistedTasks.length} tasks with validation`);
      
    } catch (error) {
      console.error('❌ [TaskPersistService] Failed to save task state:', error);
      
      // 🚨 如果是 Zod 验证错误，提供详细信息
      if (error instanceof z.ZodError) {
        console.error('🔍 [TaskPersistService] Validation errors:', {
          issues: error.issues,
          paths: error.issues.map(issue => issue.path.join('.')),
          messages: error.issues.map(issue => issue.message)
        });
      }
    }
  }

  /**
   * 🔄 从持久化存储加载任务状态
   */
  public loadTaskState(): { tasks: Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>; settings?: PersistedTaskState['settings'] } {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        console.log('📭 [TaskPersistService] No persisted tasks found');
        return { tasks: new Map() };
      }

      const rawData = JSON.parse(stored);
      
      // 🔄 数据迁移
      const migratedData = this.migrateData(rawData);
      
      // 🎯 验证数据
      const validatedState = PersistedTaskStateSchema.parse(migratedData);
      
      // 🗺️ 转换为 Map 结构
      const tasksMap = new Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>();
      
      for (const task of validatedState.tasks) {
        tasksMap.set(task.taskId, {
          taskId: task.taskId,
          literatureId: task.literatureId,
          title: task.title,
          startTime: new Date(task.startTime)
        });
      }

      console.log(`🔄 [TaskPersistService] Loaded ${tasksMap.size} tasks with validation`);
      console.log('🎯 [TaskPersistService] Task state metadata:', validatedState.metadata);
      
      return { 
        tasks: tasksMap, 
        settings: validatedState.settings 
      };
      
    } catch (error) {
      console.error('❌ [TaskPersistService] Failed to load task state:', error);
      
      // 🚨 如果是 Zod 验证错误，尝试清理损坏的数据
      if (error instanceof z.ZodError) {
        console.error('🔍 [TaskPersistService] Data validation failed:', {
          issues: error.issues,
          paths: error.issues.map(issue => issue.path.join('.')),
          messages: error.issues.map(issue => issue.message)
        });
        
        // 🧹 清理损坏的数据
        this.clearCorruptedData();
      }
      
      return { tasks: new Map() };
    }
  }

  /**
   * 🔄 数据迁移处理
   */
  private migrateData(data: any): any {
    if (!data || typeof data !== 'object') {
      return { version: this.CURRENT_VERSION, tasks: [], metadata: { lastUpdate: new Date().toISOString(), totalTasks: 0, activePollingCount: 0 } };
    }

    let currentData = data;
    const dataVersion = data.version || 0;

    // 🚀 按版本顺序执行迁移
    for (const migration of this.migrations) {
      if (dataVersion < migration.version) {
        console.log(`🔄 [TaskPersistService] Migrating data from version ${dataVersion} to ${migration.version}`);
        currentData = migration.migrate(currentData);
        currentData.version = migration.version;
      }
    }

    return currentData;
  }

  /**
   * 🗑️ 移除指定的任务
   */
  public removeTask(taskId: string): void {
    try {
      const { tasks, settings } = this.loadTaskState();
      
      if (tasks.has(taskId)) {
        tasks.delete(taskId);
        this.saveTaskState(tasks);
        console.log(`🗑️ [TaskPersistService] Removed task: ${taskId}`);
      }
    } catch (error) {
      console.error('❌ [TaskPersistService] Failed to remove task:', error);
    }
  }

  /**
   * ✏️ 更新任务信息
   */
  public updateTask(taskId: string, updates: Partial<{ status: string; retryCount: number }>): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const rawData = JSON.parse(stored);
      const migratedData = this.migrateData(rawData);
      const validatedState = PersistedTaskStateSchema.parse(migratedData);

      // 🔍 查找并更新任务
      const taskIndex = validatedState.tasks.findIndex(task => task.taskId === taskId);
      if (taskIndex !== -1) {
        validatedState.tasks[taskIndex] = {
          ...validatedState.tasks[taskIndex],
          ...updates,
          lastPolled: new Date().toISOString()
        };

        validatedState.metadata.lastUpdate = new Date().toISOString();
        
        // 💾 保存更新后的数据
        const updatedState = PersistedTaskStateSchema.parse(validatedState);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedState));
        
        console.log(`✏️ [TaskPersistService] Updated task ${taskId}:`, updates);
      }
    } catch (error) {
      console.error('❌ [TaskPersistService] Failed to update task:', error);
    }
  }

  /**
   * 🧹 清理损坏的数据
   */
  private clearCorruptedData(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🧹 [TaskPersistService] Cleared corrupted data');
    } catch (error) {
      console.error('❌ [TaskPersistService] Failed to clear corrupted data:', error);
    }
  }

  /**
   * 🧹 清理所有持久化数据
   */
  public clearAllData(): void {
    this.clearCorruptedData();
  }

  /**
   * 📊 获取持久化状态统计信息
   */
  public getStatistics(): { totalTasks: number; lastUpdate: string | null; version: number } {
    try {
      const { tasks } = this.loadTaskState();
      const stored = localStorage.getItem(this.STORAGE_KEY);
      
      if (stored) {
        const data = JSON.parse(stored);
        return {
          totalTasks: tasks.size,
          lastUpdate: data.metadata?.lastUpdate || null,
          version: data.version || 0
        };
      }
      
      return { totalTasks: 0, lastUpdate: null, version: 0 };
    } catch (error) {
      console.error('❌ [TaskPersistService] Failed to get statistics:', error);
      return { totalTasks: 0, lastUpdate: null, version: 0 };
    }
  }
}

// 🎯 导出单例实例
export const taskPersistService = TaskPersistService.getInstance();