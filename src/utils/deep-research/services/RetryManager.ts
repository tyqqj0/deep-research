import { useTaskStore } from "@/store/task";
import type { SearchTask } from "@/types";
import { ResearchError, ResearchErrorFactory } from "../types/ErrorCodes";

/**
 * 重试状态接口
 */
export interface TaskRetryState {
  taskId: string;
  retryCount: number;
  lastRetryType: 'simple' | 'regenerate';
  isAutoRetrying: boolean;
}

/**
 * 重试管理器依赖接口
 */
export interface RetryManagerDependencies {
  /**
   * 错误处理函数
   */
  handleError: (error: unknown) => void;
  
  /**
   * 运行搜索任务函数
   */
  runSearchTask: (tasks: SearchTask[], skipAutoRetry?: boolean) => Promise<void>;
  
  /**
   * 重新生成并重新运行任务函数
   */
  regenerateAndRerunTask: (taskId: string) => Promise<void>;
  
  /**
   * 检查用户是否介入
   */
  isUserIntervened: () => boolean;
  
  /**
   * 处理研究错误的回调函数
   */
  onResearchError?: (error: ResearchError) => void;
}

/**
 * 重试管理服务
 * 负责管理任务的自动重试逻辑，包括状态管理和重试策略
 */
export class RetryManager {
  private retryStates: Map<string, TaskRetryState> = new Map();
  private dependencies: RetryManagerDependencies;

  constructor(dependencies: RetryManagerDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * 获取任务的重试状态
   */
  getRetryState(taskId: string): TaskRetryState {
    return this.retryStates.get(taskId) || {
      taskId,
      retryCount: 0,
      lastRetryType: 'simple',
      isAutoRetrying: false
    };
  }

  /**
   * 更新任务的重试状态
   */
  updateRetryState(taskId: string, updates: Partial<TaskRetryState>): void {
    const current = this.getRetryState(taskId);
    this.retryStates.set(taskId, { ...current, ...updates });
  }

  /**
   * 清除指定任务的重试状态
   */
  clearRetryState(taskId: string): void {
    this.retryStates.delete(taskId);
  }

  /**
   * 清理所有重试状态（在深度研究开始时调用）
   */
  clearAllRetryStates(): void {
    console.log(`[重试状态清理] 清理所有重试状态，当前状态数量: ${this.retryStates.size}`);
    this.retryStates.clear();
  }

  /**
   * 调度重试任务
   * @param taskId 任务ID
   * @param error 原始错误
   */
  async scheduleRetry(taskId: string, error: Error): Promise<void> {
    console.log(`[重试调度] 开始调度重试，任务ID: ${taskId}`);
    
    // 异步启动自动重试，不阻塞当前执行
    this.autoRetryTask(taskId, error)
      .catch(retryError => {
        console.error("[重试调度] 自动重试流程出错:", retryError);
      });
  }

  /**
   * 执行重试（主要用于外部调用）
   * @param taskId 任务ID
   * @returns 是否成功
   */
  async executeRetry(taskId: string): Promise<boolean> {
    console.log(`[重试执行] 执行重试，任务ID: ${taskId}`);
    
    const retryState = this.getRetryState(taskId);
    
    if (retryState.retryCount < 2) {
      return await this.simpleRetry(taskId);
    } else {
      return await this.intelligentRetry(taskId);
    }
  }

  /**
   * 取消重试
   * @param taskId 任务ID
   */
  async cancelRetry(taskId: string): Promise<void> {
    console.log(`[重试取消] 取消重试，任务ID: ${taskId}`);
    this.clearRetryState(taskId);
  }

  /**
   * 简单重试（复用 rerunTask 的核心逻辑）
   */
  private async simpleRetry(taskId: string, silent: boolean = true): Promise<boolean> {
    console.log(`[自动重试] 开始简单重试，任务ID: ${taskId}, 静默模式: ${silent}`);

    if (this.dependencies.isUserIntervened()) {
      console.log("[自动重试] 检测到用户介入，停止重试");
      return false;
    }

    const { tasks, updateTask } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.type !== "search") {
      console.log("[自动重试] 任务不存在或类型错误");
      return false;
    }

    try {
      // 取消定时器
      if (task.timerId) {
        clearTimeout(task.timerId);
      }

      // 重置任务状态（保持静默）
      const updatedTask = {
        ...task,
        state: 'unprocessed' as const,
        learning: '',
        sources: [],
        images: []
      };

      updateTask(taskId, {
        state: 'unprocessed',
        learning: '',
        timerId: undefined,
        sources: [],
        images: []
      });

      // 重新执行搜索任务（跳过自动重试以防止无限循环）
      await this.dependencies.runSearchTask([updatedTask], true);
      
      // 检查任务最终状态来判断是否真正成功
      const { tasks: updatedTasks } = useTaskStore.getState();
      const finalTask = updatedTasks.find((t) => t.id === taskId);
      const isSuccess = finalTask && finalTask.type === "search" && finalTask.state === "completed";
      
      console.log(`[自动重试] 简单重试完成，任务ID: ${taskId}, 成功: ${isSuccess}`);
      return isSuccess;
    } catch (error) {
      console.error(`[自动重试] 简单重试失败，任务ID: ${taskId}`, error);
      if (!silent) {
        this.dependencies.handleError(error);
      }
      return false;
    }
  }

  /**
   * 智能重试（复用 regenerateAndRerunTask 的核心逻辑）
   */
  private async intelligentRetry(taskId: string, silent: boolean = true): Promise<boolean> {
    console.log(`[自动重试] 开始智能重试，任务ID: ${taskId}, 静默模式: ${silent}`);

    if (this.dependencies.isUserIntervened()) {
      console.log("[自动重试] 检测到用户介入，停止重试");
      return false;
    }

    try {
      // 调用原有的重新生成逻辑，但不显示 toast
      const originalHandleError = this.dependencies.handleError;
      if (silent) {
        // 临时替换错误处理函数以实现静默模式
        this.dependencies.handleError = (error: unknown) => {
          console.error("[自动重试] 智能重试出错（静默）:", error);
        };
      }

      await this.dependencies.regenerateAndRerunTask(taskId);

      // 恢复原来的错误处理函数
      if (silent) {
        this.dependencies.handleError = originalHandleError;
      }

      // 检查任务最终状态来判断是否真正成功
      const { tasks } = useTaskStore.getState();
      const finalTask = tasks.find((t) => t.id === taskId);
      const isSuccess = finalTask && finalTask.type === "search" && finalTask.state === "completed";

      console.log(`[自动重试] 智能重试完成，任务ID: ${taskId}, 成功: ${isSuccess}`);
      return isSuccess;
    } catch (error) {
      console.error(`[自动重试] 智能重试失败，任务ID: ${taskId}`, error);
      if (!silent) {
        this.dependencies.handleError(error);
      }
      return false;
    }
  }

  /**
   * 自动重试控制器
   * 实现三层重试策略：2次简单重试 + 1次智能重试
   */
  private async autoRetryTask(taskId: string, originalError: Error): Promise<void> {
    console.log(`[自动重试] 开始自动重试流程，任务ID: ${taskId}`);

    const retryState = this.getRetryState(taskId);

    // 防止重复重试
    if (retryState.isAutoRetrying) {
      console.log(`[自动重试] 任务 ${taskId} 已在重试中，跳过`);
      return;
    }

    this.updateRetryState(taskId, { isAutoRetrying: true });

    try {
      // 第1-2次：简单重试
      for (let i = 1; i <= 2; i++) {
        if (this.dependencies.isUserIntervened()) {
          console.log("[自动重试] 用户介入，停止自动重试");
          return;
        }

        console.log(`[自动重试] 第${i}次简单重试，任务ID: ${taskId}`);
        this.updateRetryState(taskId, { retryCount: i, lastRetryType: 'simple' });

        const success = await this.simpleRetry(taskId, true);
        if (success) {
          console.log(`[自动重试] 第${i}次简单重试成功，任务ID: ${taskId}`);
          this.clearRetryState(taskId);
          return;
        }

        console.log(`[自动重试] 第${i}次简单重试失败，任务ID: ${taskId}`);

        // 等待一秒再继续
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 第3次：智能重试
      if (this.dependencies.isUserIntervened()) {
        console.log("[自动重试] 用户介入，停止自动重试");
        return;
      }

      console.log(`[自动重试] 第3次智能重试，任务ID: ${taskId}`);
      this.updateRetryState(taskId, { retryCount: 3, lastRetryType: 'regenerate' });

      const success = await this.intelligentRetry(taskId, true);
      if (success) {
        console.log(`[自动重试] 第3次智能重试成功，任务ID: ${taskId}`);
        this.clearRetryState(taskId);
        return;
      }

      console.log(`[自动重试] 所有重试均失败，任务ID: ${taskId}`);

      // 所有重试都失败，处理最终失败
      const finalError = await this.handleFinalFailure(taskId, originalError);
      
      // 通过传统错误处理显示给用户
      this.dependencies.handleError(`[最终失败] ${originalError.message} - 已尝试3次自动重试`);
      
      console.log('[自动重试] 最终失败错误对象:', finalError);

    } finally {
      this.clearRetryState(taskId);
    }
  }

  /**
   * 处理最终失败
   * 现在返回ResearchError而不是直接更新UI
   */
  private async handleFinalFailure(taskId: string, originalError: Error): Promise<ResearchError> {
    // 获取任务标题用于错误上下文
    const { tasks } = useTaskStore.getState();
    const task = tasks.find(t => t.id === taskId);
    const taskTitle = task?.title || taskId;
    
    // 创建重试耗尽错误
    const retryError = ResearchErrorFactory.createRetryExhausted(
      taskId,
      3, // 重试次数
      originalError
    );
    
    // 添加任务标题到上下文
    retryError.context = {
      ...retryError.context,
      taskTitle,
      originalErrorMessage: originalError.message,
      retryDescription: '已尝试3次自动重试（2次简单重试 + 1次智能重试）均失败'
    };
    
    // 如果有错误处理回调，调用它
    if (this.dependencies.onResearchError) {
      this.dependencies.onResearchError(retryError);
    }
    
    return retryError;
  }

  /**
   * 获取重试统计信息（用于调试和监控）
   */
  getRetryStats(): {
    totalRetryingTasks: number;
    retryStatesByTaskId: Record<string, TaskRetryState>;
  } {
    const retryStatesByTaskId: Record<string, TaskRetryState> = {};
    
    this.retryStates.forEach((state, taskId) => {
      retryStatesByTaskId[taskId] = { ...state };
    });

    return {
      totalRetryingTasks: this.retryStates.size,
      retryStatesByTaskId
    };
  }
}

/**
 * 创建重试管理器实例的工厂函数
 */
export function createRetryManager(dependencies: RetryManagerDependencies): RetryManager {
  return new RetryManager(dependencies);
}

/**
 * 默认导出
 */
export default RetryManager;