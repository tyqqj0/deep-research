/**
 * 🔄 TaskRecoveryService - 任务恢复服务
 * 
 * 职责:
 * 1. 智能识别未完成任务
 * 2. 从多个数据源恢复任务状态
 * 3. 处理任务恢复的优先级和策略
 * 4. 提供恢复过程的监控和日志
 * 
 * 设计原则:
 * - 多源恢复：从持久化存储和文献数据库恢复
 * - 智能合并：优先使用最准确的数据源
 * - 状态推断：基于 BackendTask 推断任务状态
 * - 容错处理：处理数据不一致和损坏情况
 */

import type { LibraryItem } from '@/libs/db';
import { taskPersistService } from './TaskPersistService';
import { taskStateManager } from './TaskStateManager';

// 🎯 任务恢复配置
interface RecoveryConfig {
  maxRecoveryAge: number;        // 最大恢复时间范围（毫秒）
  priorityStrategy: 'persistence' | 'database' | 'smart'; // 优先策略
  includeFailedTasks: boolean;   // 是否包含失败的任务
  maxConcurrentRecovery: number; // 最大并发恢复数量
}

// 🎯 恢复统计信息
export interface RecoveryStatistics {
  totalItemsScanned: number;
  tasksFromPersistence: number;
  tasksFromDatabase: number;
  tasksMerged: number;
  tasksRecovered: number;
  tasksSkipped: number;
  recoveryDuration: number;
  errors: string[];
}

// 🎯 恢复来源
type RecoverySource = 'persistence' | 'database' | 'merged';

// 🎯 恢复的任务信息
interface RecoveredTaskInfo {
  taskId: string;
  literatureId: string;
  title: string;
  startTime: Date;
  source: RecoverySource;
  confidence: number; // 0-1，恢复置信度
  metadata?: {
    lastPolled?: Date;
    retryCount?: number;
    executionStatus?: string;
  };
}

/**
 * 🔄 TaskRecoveryService - 任务恢复服务类
 */
export class TaskRecoveryService {
  private static instance: TaskRecoveryService;
  
  // 🎯 默认恢复配置
  private readonly defaultConfig: RecoveryConfig = {
    maxRecoveryAge: 24 * 60 * 60 * 1000, // 24小时
    priorityStrategy: 'smart',
    includeFailedTasks: false,
    maxConcurrentRecovery: 10
  };

  private constructor() {}

  public static getInstance(): RecoveryService {
    if (!TaskRecoveryService.instance) {
      TaskRecoveryService.instance = new TaskRecoveryService();
    }
    return TaskRecoveryService.instance;
  }

  /**
   * 🚀 智能恢复任务
   * 
   * 执行流程:
   * 1. 从持久化存储恢复任务
   * 2. 从文献数据库发现未完成任务  
   * 3. 智能合并和去重
   * 4. 应用恢复策略和过滤
   */
  public async smartRecoverTasks(
    items: LibraryItem[], 
    config: Partial<RecoveryConfig> = {}
  ): Promise<{ 
    tasks: Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>;
    statistics: RecoveryStatistics;
  }> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config };
    
    console.log('🚀 [TaskRecoveryService] Starting smart task recovery...', {
      totalItems: items.length,
      config: finalConfig
    });

    const statistics: RecoveryStatistics = {
      totalItemsScanned: 0,
      tasksFromPersistence: 0,
      tasksFromDatabase: 0,
      tasksMerged: 0,
      tasksRecovered: 0,
      tasksSkipped: 0,
      recoveryDuration: 0,
      errors: []
    };

    try {
      // 📊 第一步：从持久化存储恢复
      const persistedTasks = await this.recoverFromPersistence();
      statistics.tasksFromPersistence = persistedTasks.size;
      console.log(`📦 [TaskRecoveryService] Recovered ${persistedTasks.size} tasks from persistence`);

      // 🔍 第二步：从数据库发现未完成任务
      const databaseTasks = await this.discoverFromDatabase(items, finalConfig);
      statistics.tasksFromDatabase = databaseTasks.size;
      statistics.totalItemsScanned = items.length;
      console.log(`🔍 [TaskRecoveryService] Discovered ${databaseTasks.size} tasks from database`);

      // 🧠 第三步：智能合并任务
      const mergedTasks = this.mergeTasks(persistedTasks, databaseTasks, finalConfig);
      statistics.tasksMerged = mergedTasks.size;
      console.log(`🧠 [TaskRecoveryService] Merged ${mergedTasks.size} unique tasks`);

      // 🎯 第四步：应用过滤和优先级策略
      const filteredTasks = this.applyRecoveryFilters(mergedTasks, finalConfig);
      statistics.tasksRecovered = filteredTasks.size;
      statistics.tasksSkipped = mergedTasks.size - filteredTasks.size;

      // 🔄 第五步：转换为标准格式
      const finalTasks = this.convertToStandardFormat(filteredTasks);

      statistics.recoveryDuration = Date.now() - startTime;

      console.log('✅ [TaskRecoveryService] Smart recovery completed:', {
        recovered: statistics.tasksRecovered,
        skipped: statistics.tasksSkipped,
        duration: `${statistics.recoveryDuration}ms`
      });

      return { tasks: finalTasks, statistics };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      statistics.errors.push(errorMessage);
      statistics.recoveryDuration = Date.now() - startTime;
      
      console.error('❌ [TaskRecoveryService] Recovery failed:', error);
      
      return { tasks: new Map(), statistics };
    }
  }

  /**
   * 📦 从持久化存储恢复任务
   */
  private async recoverFromPersistence(): Promise<Map<string, RecoveredTaskInfo>> {
    try {
      const { tasks: persistedTasks } = taskPersistService.loadTaskState();
      const recoveredTasks = new Map<string, RecoveredTaskInfo>();

      for (const [taskId, taskInfo] of persistedTasks.entries()) {
        recoveredTasks.set(taskId, {
          taskId: taskInfo.taskId,
          literatureId: taskInfo.literatureId,
          title: taskInfo.title,
          startTime: taskInfo.startTime,
          source: 'persistence',
          confidence: 0.9, // 持久化数据置信度较高
          metadata: {
            lastPolled: new Date() // 假设最近轮询过
          }
        });
      }

      return recoveredTasks;
    } catch (error) {
      console.error('❌ [TaskRecoveryService] Failed to recover from persistence:', error);
      return new Map();
    }
  }

  /**
   * 🔍 从数据库发现未完成任务
   */
  private async discoverFromDatabase(
    items: LibraryItem[], 
    config: RecoveryConfig
  ): Promise<Map<string, RecoveredTaskInfo>> {
    const discoveredTasks = new Map<string, RecoveredTaskInfo>();

    for (const item of items) {
      try {
        // 🎯 使用 TaskStateManager 判断任务状态
        const isCompleted = taskStateManager.isTaskCompleted(item);
        const shouldShowAsProcessing = taskStateManager.shouldShowAsProcessing(item);

        // 🚀 包含处理中的任务
        if (!isCompleted && shouldShowAsProcessing) {
          const taskId = item.backendTask?.task_id;
          
          if (taskId) {
            // 🕐 检查任务年龄
            const taskAge = Date.now() - item.createdAt.getTime();
            if (taskAge > config.maxRecoveryAge) {
              console.log(`⏰ [TaskRecoveryService] Skipping old task: ${taskId} (age: ${Math.round(taskAge / 1000 / 60)}min)`);
              continue;
            }

            // 📊 计算置信度
            const confidence = this.calculateDatabaseConfidence(item);

            discoveredTasks.set(taskId, {
              taskId,
              literatureId: item.id,
              title: item.title,
              startTime: item.createdAt,
              source: 'database',
              confidence,
              metadata: {
                executionStatus: item.backendTask?.execution_status,
                retryCount: 0
              }
            });
          }
        }

        // 🚨 可选：包含失败的任务
        if (config.includeFailedTasks && item.backendTask?.execution_status === 'failed') {
          const taskId = item.backendTask.task_id;
          if (taskId && !discoveredTasks.has(taskId)) {
            discoveredTasks.set(taskId, {
              taskId,
              literatureId: item.id,
              title: item.title,
              startTime: item.createdAt,
              source: 'database',
              confidence: 0.3, // 失败任务置信度较低
              metadata: {
                executionStatus: 'failed',
                retryCount: 1
              }
            });
          }
        }

      } catch (error) {
        console.error(`❌ [TaskRecoveryService] Error processing item ${item.id}:`, error);
      }
    }

    return discoveredTasks;
  }

  /**
   * 🧠 智能合并任务
   */
  private mergeTasks(
    persistedTasks: Map<string, RecoveredTaskInfo>,
    databaseTasks: Map<string, RecoveredTaskInfo>,
    config: RecoveryConfig
  ): Map<string, RecoveredTaskInfo> {
    const mergedTasks = new Map<string, RecoveredTaskInfo>();

    // 🎯 第一步：处理持久化任务
    for (const [taskId, taskInfo] of persistedTasks.entries()) {
      mergedTasks.set(taskId, taskInfo);
    }

    // 🎯 第二步：合并数据库任务
    for (const [taskId, databaseTask] of databaseTasks.entries()) {
      const existingTask = mergedTasks.get(taskId);

      if (existingTask) {
        // 🧠 智能合并策略
        const mergedTask = this.smartMergeTask(existingTask, databaseTask, config);
        mergedTasks.set(taskId, mergedTask);
      } else {
        // 🆕 新任务，直接添加
        mergedTasks.set(taskId, databaseTask);
      }
    }

    return mergedTasks;
  }

  /**
   * 🧠 智能合并单个任务
   */
  private smartMergeTask(
    persistedTask: RecoveredTaskInfo,
    databaseTask: RecoveredTaskInfo,
    config: RecoveryConfig
  ): RecoveredTaskInfo {
    // 🎯 基于策略选择主要数据源
    let primaryTask: RecoveredTaskInfo;
    let secondaryTask: RecoveredTaskInfo;

    switch (config.priorityStrategy) {
      case 'persistence':
        primaryTask = persistedTask;
        secondaryTask = databaseTask;
        break;
      case 'database':
        primaryTask = databaseTask;
        secondaryTask = persistedTask;
        break;
      case 'smart':
      default:
        // 🧠 智能选择：置信度高的作为主要任务
        if (persistedTask.confidence >= databaseTask.confidence) {
          primaryTask = persistedTask;
          secondaryTask = databaseTask;
        } else {
          primaryTask = databaseTask;
          secondaryTask = persistedTask;
        }
        break;
    }

    // 🔄 合并元数据
    const mergedMetadata = {
      ...secondaryTask.metadata,
      ...primaryTask.metadata,
      // 特殊处理：使用数据库的最新执行状态
      executionStatus: databaseTask.metadata?.executionStatus || primaryTask.metadata?.executionStatus
    };

    return {
      ...primaryTask,
      source: 'merged',
      confidence: Math.max(primaryTask.confidence, secondaryTask.confidence),
      metadata: mergedMetadata
    };
  }

  /**
   * 🎯 应用恢复过滤器
   */
  private applyRecoveryFilters(
    tasks: Map<string, RecoveredTaskInfo>,
    config: RecoveryConfig
  ): Map<string, RecoveredTaskInfo> {
    const filteredTasks = new Map<string, RecoveredTaskInfo>();

    for (const [taskId, taskInfo] of tasks.entries()) {
      // 🎯 置信度过滤
      if (taskInfo.confidence < 0.5) {
        console.log(`🎯 [TaskRecoveryService] Skipping low confidence task: ${taskId} (confidence: ${taskInfo.confidence})`);
        continue;
      }

      // 🕐 年龄过滤
      const taskAge = Date.now() - taskInfo.startTime.getTime();
      if (taskAge > config.maxRecoveryAge) {
        console.log(`⏰ [TaskRecoveryService] Skipping old task: ${taskId} (age: ${Math.round(taskAge / 1000 / 60)}min)`);
        continue;
      }

      // ✅ 通过所有过滤器
      filteredTasks.set(taskId, taskInfo);
    }

    return filteredTasks;
  }

  /**
   * 🔄 转换为标准格式
   */
  private convertToStandardFormat(
    tasks: Map<string, RecoveredTaskInfo>
  ): Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }> {
    const standardTasks = new Map<string, { taskId: string; literatureId: string; title: string; startTime: Date }>();

    for (const [taskId, taskInfo] of tasks.entries()) {
      standardTasks.set(taskId, {
        taskId: taskInfo.taskId,
        literatureId: taskInfo.literatureId,
        title: taskInfo.title,
        startTime: taskInfo.startTime
      });
    }

    return standardTasks;
  }

  /**
   * 📊 计算数据库任务的置信度
   */
  private calculateDatabaseConfidence(item: LibraryItem): number {
    let confidence = 0.7; // 基础置信度

    // 🎯 有任务ID加分
    if (item.backendTask?.task_id) {
      confidence += 0.1;
    }

    // 📊 执行状态加分
    if (item.backendTask?.execution_status === 'processing') {
      confidence += 0.1;
    } else if (item.backendTask?.execution_status === 'pending') {
      confidence += 0.05;
    }

    // 🕐 创建时间较新加分
    const itemAge = Date.now() - item.createdAt.getTime();
    if (itemAge < 60 * 60 * 1000) { // 1小时内
      confidence += 0.1;
    } else if (itemAge < 6 * 60 * 60 * 1000) { // 6小时内
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }
}

// 🎯 导出单例实例和类型
export const taskRecoveryService = TaskRecoveryService.getInstance();
export type { RecoveryConfig, RecoveryStatistics, RecoveredTaskInfo };

// 🎯 类型别名修正
type RecoveryService = TaskRecoveryService;