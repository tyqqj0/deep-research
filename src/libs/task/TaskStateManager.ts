/**
 * 🎯 TaskStateManager - 统一任务状态管理服务
 * 
 * 核心职责:
 * 1. 统一的任务状态计算和显示逻辑
 * 2. 持久化轮询任务状态，解决页面刷新问题
 * 3. 提供标准化的状态显示接口
 * 4. 任务生命周期管理
 * 
 * 设计原则:
 * - 单一职责：只处理任务状态相关逻辑
 * - 无UI依赖：纯业务逻辑服务
 * - 状态标准化：统一的显示状态格式
 */

import type { LibraryItem, BackendTask } from '@/libs/db/schema';

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

// 🔄 持久化的任务追踪信息
export interface PersistedTaskInfo {
  taskId: string;
  literatureId: string;
  title: string;
  startTime: string; // ISO string for serialization
  lastPolled: string; // ISO string
}

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
  private readonly STORAGE_KEY = 'literature-active-tasks';

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

  /**
   * 💾 持久化轮询任务状态到localStorage
   */
  public persistActiveTasks(tasks: Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>): void {
    try {
      const persistedTasks: PersistedTaskInfo[] = [];
      
      for (const [taskId, taskInfo] of tasks.entries()) {
        persistedTasks.push({
          taskId: taskInfo.taskId,
          literatureId: taskInfo.literatureId,
          title: taskInfo.title,
          startTime: taskInfo.startTime.toISOString(),
          lastPolled: new Date().toISOString()
        });
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(persistedTasks));
      console.log(`💾 Persisted ${persistedTasks.length} active tasks to localStorage`);
    } catch (error) {
      console.error('❌ Failed to persist active tasks:', error);
    }
  }

  /**
   * 🔄 从持久化存储恢复轮询任务
   */
  public recoverPersistedTasks(): Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        console.log('📭 No persisted tasks found');
        return new Map();
      }

      const persistedTasks: PersistedTaskInfo[] = JSON.parse(stored);
      const recoveredTasks = new Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>();

      for (const task of persistedTasks) {
        recoveredTasks.set(task.taskId, {
          taskId: task.taskId,
          literatureId: task.literatureId,
          title: task.title,
          startTime: new Date(task.startTime)
        });
      }

      console.log(`🔄 Recovered ${recoveredTasks.size} tasks from localStorage`);
      return recoveredTasks;
    } catch (error) {
      console.error('❌ Failed to recover persisted tasks:', error);
      return new Map();
    }
  }

  /**
   * 🔍 从LibraryItems中发现未完成的任务
   * 
   * 只会发现真正需要继续轮询的任务：
   * - 排除 URL 验证失败的任务
   * - 排除执行失败的任务
   * - 只包含 pending 和 processing 状态的任务
   */
  public discoverIncompleteTasks(items: LibraryItem[]): Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }> {
    const incompleteTasks = new Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>();

    for (const item of items) {
      // 🎯 双重检查确保只恢复真正需要轮询的任务
      if (!this.isTaskCompleted(item) && this.shouldShowAsProcessing(item)) {
        const taskId = item.backendTask?.task_id;
        if (taskId) {
          console.log(`🔍 Discovered incomplete task: ${taskId} (${item.title}) - status: ${item.backendTask?.execution_status}`);
          incompleteTasks.set(taskId, {
            taskId,
            literatureId: item.id,
            title: item.title,
            startTime: item.createdAt
          });
        }
      }
    }

    console.log(`🔍 Discovered ${incompleteTasks.size} incomplete tasks from library items`);
    return incompleteTasks;
  }

  /**
   * 🚀 智能恢复：合并持久化任务和发现的任务
   * 
   * 恢复策略：
   * 1. 从 localStorage 恢复持久化的任务
   * 2. 从当前 LibraryItems 发现需要轮询的任务
   * 3. 合并两个来源，优先使用发现的任务（更准确的当前状态）
   * 4. 自动排除已失败和 URL 错误的任务
   */
  public smartRecoverTasks(items: LibraryItem[]): Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }> {
    console.log(`🚀 Starting smart task recovery for ${items.length} library items...`);
    
    const persistedTasks = this.recoverPersistedTasks();
    const discoveredTasks = this.discoverIncompleteTasks(items);

    // 合并两个来源，优先使用发现的任务（更准确的当前状态）
    const mergedTasks = new Map(persistedTasks);
    
    let discoveredCount = 0;
    for (const [taskId, taskInfo] of discoveredTasks.entries()) {
      mergedTasks.set(taskId, taskInfo);
      discoveredCount++;
    }

    console.log(`🚀 Smart recovery completed:`);
    console.log(`   - Persisted tasks: ${persistedTasks.size}`);
    console.log(`   - Discovered tasks: ${discoveredCount}`);
    console.log(`   - Total tasks to track: ${mergedTasks.size}`);
    
    if (mergedTasks.size === 0) {
      console.log(`✨ No incomplete tasks found - all literature items are in stable states`);
    }
    
    return mergedTasks;
  }

  /**
   * 🗑️ 移除已完成的任务
   */
  public removeCompletedTask(taskId: string): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const persistedTasks: PersistedTaskInfo[] = JSON.parse(stored);
      const filteredTasks = persistedTasks.filter(task => task.taskId !== taskId);

      if (filteredTasks.length !== persistedTasks.length) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredTasks));
        console.log(`🗑️ Removed completed task ${taskId} from persistence`);
      }
    } catch (error) {
      console.error('❌ Failed to remove completed task:', error);
    }
  }

  /**
   * 🧹 清理所有持久化任务
   */
  public clearPersistedTasks(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🧹 Cleared all persisted tasks');
    } catch (error) {
      console.error('❌ Failed to clear persisted tasks:', error);
    }
  }
}

// 🎯 导出单例实例
export const taskStateManager = TaskStateManager.getInstance();