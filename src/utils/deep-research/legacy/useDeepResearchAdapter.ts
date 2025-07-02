
import { ResearchEngine } from "../core/ResearchEngine";
import { SearchTask } from "@/types";
import { useTaskStore } from "@/store/task";
import { useEffect, useState } from "react";

/**
 * 创建与原始 useDeepResearch hook 完全兼容的适配器
 * 这个适配器提供了与原始 hook 相同的 API 接口，但使用新的 ResearchEngine
 */
export function createDeepResearchAdapter() {
  const engine = new ResearchEngine();
  
  // 使用 React hooks 来管理状态同步
  const [status, setStatus] = useState<string>("idle");
  
  // 订阅任务存储状态更新
  useEffect(() => {
    const unsubscribe = useTaskStore.subscribe(
      (state) => state.status,
      (currentStatus) => {
        setStatus(currentStatus);
      }
    );
    
    return unsubscribe;
  }, []);

  // 返回与原始 useDeepResearch 完全相同的接口
  return {
    // 状态管理 - 与任务存储同步
    status,

    // 核心研究方法
    deepResearch: async () => {
      try {
        await engine.askQuestions();
      } catch (error) {
        console.error("[useDeepResearchAdapter] deepResearch error:", error);
        throw error;
      }
    },

    askQuestions: async () => {
      try {
        await engine.askQuestions();
      } catch (error) {
        console.error("[useDeepResearchAdapter] askQuestions error:", error);
        throw error;
      }
    },

    writeReportPlan: async () => {
      try {
        return await engine.writeReportPlan();
      } catch (error) {
        console.error("[useDeepResearchAdapter] writeReportPlan error:", error);
        throw error;
      }
    },

    writeFinalReport: async () => {
      try {
        return await engine.writeFinalReport();
      } catch (error) {
        console.error("[useDeepResearchAdapter] writeFinalReport error:", error);
        throw error;
      }
    },

    // 搜索任务管理
    runSearchTask: async (queries: SearchTask[], skipAutoRetry?: boolean) => {
      try {
        await engine.runSearchTask(queries, skipAutoRetry);
      } catch (error) {
        console.error("[useDeepResearchAdapter] runSearchTask error:", error);
        throw error;
      }
    },

    runWiderResearch: async () => {
      try {
        await engine.runWiderResearch();
      } catch (error) {
        console.error("[useDeepResearchAdapter] runWiderResearch error:", error);
        throw error;
      }
    },

    runDeeperResearch: async (taskId: string) => {
      try {
        await engine.runDeeperResearch(taskId);
      } catch (error) {
        console.error("[useDeepResearchAdapter] runDeeperResearch error:", error);
        throw error;
      }
    },

    // 任务管理方法
    rerunTask: async (taskId: string) => {
      try {
        await engine.rerunTask(taskId);
      } catch (error) {
        console.error("[useDeepResearchAdapter] rerunTask error:", error);
        throw error;
      }
    },

    regenerateAndRerunTask: async (taskId: string) => {
      try {
        await engine.regenerateAndRerunTask(taskId);
      } catch (error) {
        console.error("[useDeepResearchAdapter] regenerateAndRerunTask error:", error);
        throw error;
      }
    },

    cancelTask: async (taskId: string) => {
      try {
        await engine.cancelTask(taskId);
      } catch (error) {
        console.error("[useDeepResearchAdapter] cancelTask error:", error);
        throw error;
      }
    },

    regenerateSummary: async (taskId: string) => {
      try {
        await engine.regenerateSummary(taskId);
      } catch (error) {
        console.error("[useDeepResearchAdapter] regenerateSummary error:", error);
        throw error;
      }
    },

    // 深度研究控制
    cancelDeeperResearch: async () => {
      try {
        await engine.cancelDeeperResearch();
      } catch (error) {
        console.error("[useDeepResearchAdapter] cancelDeeperResearch error:", error);
        throw error;
      }
    },

    checkAutoDeepResearch: async () => {
      try {
        await engine.checkAutoDeepResearch();
      } catch (error) {
        console.error("[useDeepResearchAdapter] checkAutoDeepResearch error:", error);
        throw error;
      }
    },

    // 重试管理
    autoRetryTask: async (taskId: string, originalError: Error) => {
      try {
        // 这个方法在新架构中由 RetryManager 自动处理
        // 在适配器中提供兼容性接口
        const retryManager = (engine as any).retryManager;
        if (retryManager && retryManager.scheduleRetry) {
          await retryManager.scheduleRetry(taskId, originalError);
        } else {
          console.warn("[useDeepResearchAdapter] RetryManager not available");
        }
      } catch (error) {
        console.error("[useDeepResearchAdapter] autoRetryTask error:", error);
        throw error;
      }
    },

    clearAllRetryStates: () => {
      try {
        engine.clearAllRetryStates();
      } catch (error) {
        console.error("[useDeepResearchAdapter] clearAllRetryStates error:", error);
        throw error;
      }
    },

    // 调试和监控方法
    getRetryStats: () => {
      try {
        return engine.getRetryStats();
      } catch (error) {
        console.error("[useDeepResearchAdapter] getRetryStats error:", error);
        return {
          totalRetryingTasks: 0,
          retryStatesByTaskId: {}
        };
      }
    },

    // 内部访问（用于高级用户或调试）
    getEngine: () => engine,
  };
}

/**
 * 为了兼容性，也提供 hook 风格的使用方式
 * 这个函数可以直接替换原始的 useDeepResearch hook
 */
export function useDeepResearchAdapter() {
  return createDeepResearchAdapter();
}

/**
 * 默认导出 - 使用适配器创建函数
 */
export default createDeepResearchAdapter;
