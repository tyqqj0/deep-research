
import { SearchStrategy } from "../strategies/SearchStrategy";
import { DeeperStrategy, DeeperStrategyDependencies } from "../strategies/DeeperStrategy";
import { RetryManager, RetryManagerDependencies } from "../services/RetryManager";
import { SearchTask } from "@/types";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import { useSettingStore } from "@/store/setting";
import { streamText } from "ai";
import useModelProvider from "@/hooks/useAiProvider";
import { parseError } from "@/utils/error";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import {
  getSystemPrompt,
  generateQuestionsPrompt,
  writeFinalReportPrompt,
} from "@/utils/deep-research/prompts";
import { removeJsonMarkdown } from "@/utils/text";
import { parsePartialJson } from "@ai-sdk/ui-utils";
import { t } from "i18next";

function getResponseLanguagePrompt() {
  return `\n\n**Respond in the same language as the user's language**`;
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

export class ResearchEngine {
  private searchStrategy: SearchStrategy;
  private deeperStrategy: DeeperStrategy;
  private retryManager: RetryManager;
  private createModelProvider: any;
  private getModel: any;

  constructor() {
    const modelProvider = useModelProvider();
    this.createModelProvider = modelProvider.createModelProvider;
    this.getModel = modelProvider.getModel;
    // 先创建基础策略实例
    this.searchStrategy = new SearchStrategy();
    
    // 为DeeperStrategy提供依赖注入
    const deeperDependencies: DeeperStrategyDependencies = {
      runSearchTask: (tasks: SearchTask[]) => this.runSearchTask(tasks)
    };
    this.deeperStrategy = new DeeperStrategy(deeperDependencies);
    
    // 最后创建RetryManager，避免循环依赖
    const retryDependencies: RetryManagerDependencies = {
      handleError: handleError,
      runSearchTask: (tasks: SearchTask[], skipAutoRetry?: boolean) => 
        this.runSearchTask(tasks, skipAutoRetry),
      regenerateAndRerunTask: (taskId: string) => 
        this.regenerateAndRerunTask(taskId),
      isUserIntervened: () => this.isUserIntervened()
    };
    
    this.retryManager = new RetryManager(retryDependencies);
    
    // 注入RetryManager到SearchStrategy
    this.searchStrategy.setRetryManager(this.retryManager);
  }

  // 核心搜索任务执行
  async runSearchTask(
    queries: SearchTask[],
    skipAutoRetry?: boolean
  ): Promise<void> {
    return this.searchStrategy.execute(queries, skipAutoRetry);
  }

  // 深度研究执行
  async runDeeperResearch(taskId: string): Promise<void> {
    return this.deeperStrategy.execute(taskId);
  }

  // 生成研究问题
  async askQuestions(): Promise<void> {
    const { question, updateQuestions, setQuestion } = useTaskStore.getState();
    const { thinkingModel } = this.getModel();

    if (!question || !question.trim()) {
      throw new Error("No research question provided");
    }

    try {
      const questionResult = streamText({
        model: await this.createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          generateQuestionsPrompt(question),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      let questionContent = "";
      for await (const textPart of questionResult.textStream) {
        questionContent += textPart;
        updateQuestions(questionContent);
      }

      setQuestion(question);
    } catch (error) {
      handleError(error);
      throw error;
    }
  }

  // 生成报告计划
  async writeReportPlan(): Promise<string> {
    const { question, tasks, updateReportPlan } = useTaskStore.getState();
    const { thinkingModel } = this.getModel();

    const completedTasks = tasks.filter(
      (t): t is SearchTask => t.type === "search" && t.state === "completed"
    );

    const learnings = completedTasks.map((t) => t.learning).filter(Boolean);

    if (learnings.length === 0) {
      throw new Error("No completed search tasks available for plan generation");
    }

    try {
      const planResult = streamText({
        model: await this.createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          writePlanPrompt(question, learnings),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      let planContent = "";
      for await (const textPart of planResult.textStream) {
        planContent += textPart;
        updateReportPlan(planContent);
      }

      return planContent;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }

  // 生成最终报告
  async writeFinalReport(): Promise<string> {
    const { 
      question, 
      tasks, 
      reportPlan, 
      updateFinalReport 
    } = useTaskStore.getState();
    const { thinkingModel } = this.getModel();
    const { save } = useHistoryStore.getState();

    const completedTasks = tasks.filter(
      (t): t is SearchTask => t.type === "search" && t.state === "completed"
    );

    const learnings = completedTasks.map((t) => t.learning).filter(Boolean);
    const sources = completedTasks.flatMap((t) => t.sources || []);
    const images = completedTasks.flatMap((t) => t.images || []);

    if (learnings.length === 0) {
      throw new Error("No completed search tasks available for final report");
    }

    try {
      const reportResult = streamText({
        model: await this.createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          writeFinalReportPrompt(question, reportPlan, learnings, sources),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      let reportContent = "";
      for await (const textPart of reportResult.textStream) {
        reportContent += textPart;
        updateFinalReport(reportContent);
      }

      // 保存到历史记录
      save({
        id: nanoid(),
        title: question,
        content: reportContent,
        timestamp: Date.now(),
        sources: sources,
        images: images,
      });

      return reportContent;
    } catch (error) {
      handleError(error);
      throw error;
    }
  }

  // 扩展研究
  async runWiderResearch(): Promise<void> {
    const {
      researchStatus,
      question,
      reportPlan,
      tasks,
      addTasks,
      updateSuggestion,
      setResearchStatus,
    } = useTaskStore.getState();
    const { thinkingModel } = this.getModel();
    const { widerSearchMaxTasks } = useSettingStore.getState();

    if (researchStatus !== "idle") {
      console.log("[runWiderResearch] Research is already in progress");
      return;
    }

    const completedTasks = tasks.filter(
      (t): t is SearchTask => t.type === "search" && t.state === "completed"
    );
    const learnings = completedTasks.map((t) => t.learning).filter(Boolean);

    if (learnings.length === 0) {
      throw new Error("No completed search tasks available for wider research");
    }

    setResearchStatus("wider-research");

    try {
      const widerResult = streamText({
        model: await this.createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          generateWiderResearchPrompt(
            question,
            reportPlan,
            learnings,
            widerSearchMaxTasks
          ),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      let widerContent = "";
      for await (const textPart of widerResult.textStream) {
        widerContent += textPart;
        updateSuggestion(widerContent);
      }

      // 解析并创建新的搜索任务
      const cleanedContent = removeJsonMarkdown(widerContent);
      const data = parsePartialJson(cleanedContent);

      if (data.value && Array.isArray(data.value)) {
        const newTasks = data.value
          .filter((task: any) => task.query && task.title && task.researchGoal)
          .map((task: any) => ({
            id: nanoid(),
            type: "search" as const,
            query: task.query,
            researchGoal: task.researchGoal,
            title: task.title,
            state: "unprocessed" as const,
            learning: "",
            sources: [],
            images: [],
            depth: 0,
          }));

        if (newTasks.length > 0) {
          addTasks(newTasks);
          await this.runSearchTask(newTasks);
        }
      }
    } catch (error) {
      handleError(error);
      throw error;
    } finally {
      setResearchStatus("idle");
    }
  }

  // 重新运行任务
  async rerunTask(taskId: string): Promise<void> {
    const { tasks, updateTask } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.type !== "search") {
      throw new Error(`Task with id ${taskId} not found or not a search task`);
    }

    try {
      // 清除定时器
      if (task.timerId) {
        clearTimeout(task.timerId);
      }

      // 重置任务状态
      updateTask(taskId, {
        state: "unprocessed",
        learning: "",
        timerId: undefined,
        sources: [],
        images: [],
      });

      // 重新执行搜索任务（跳过自动重试以避免循环）
      await this.runSearchTask([task as SearchTask], true);
    } catch (error) {
      handleError(error);
      throw error;
    }
  }

  // 重新生成并重新运行任务
  async regenerateAndRerunTask(taskId: string): Promise<void> {
    const { tasks, reportPlan, updateTask } = useTaskStore.getState();
    const { thinkingModel } = this.getModel();
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.type !== "search") {
      throw new Error(`Task with id ${taskId} not found or not a search task`);
    }

    try {
      updateTask(taskId, { state: "processing" });

      // 使用AI重新生成查询和目标
      const regenerateResult = streamText({
        model: await this.createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          regenerateTaskPrompt(
            task.query,
            task.researchGoal,
            task.title,
            reportPlan
          ),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      let regenerateContent = "";
      for await (const textPart of regenerateResult.textStream) {
        regenerateContent += textPart;
      }

      const cleanedContent = removeJsonMarkdown(regenerateContent);
      const data = parsePartialJson(cleanedContent);

      if (data.value && typeof data.value === "object") {
        const newQuery = data.value.query || task.query;
        const newGoal = data.value.researchGoal || task.researchGoal;
        const newTitle = data.value.title || task.title;

        // 更新任务信息
        updateTask(taskId, {
          query: newQuery,
          researchGoal: newGoal,
          title: newTitle,
          state: "unprocessed",
          learning: "",
          sources: [],
          images: [],
        });

        // 重新执行搜索任务
        const updatedTask = {
          ...task,
          query: newQuery,
          researchGoal: newGoal,
          title: newTitle,
        } as SearchTask;

        await this.runSearchTask([updatedTask], true);
        toast.success(t("research.success.taskRegenerated"));
      } else {
        throw new Error("Failed to parse regenerated task data");
      }
    } catch (error) {
      updateTask(taskId, { state: "failed" });
      handleError(error);
      throw error;
    }
  }

  // 取消任务
  async cancelTask(taskId: string): Promise<void> {
    const { tasks, updateTask, removeTask, setResearchStatus } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId);

    if (!task) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    try {
      // 清除定时器
      if (task.type === "search" && task.timerId) {
        clearTimeout(task.timerId);
      }

      // 标记为已取消
      updateTask(taskId, { state: "cancelled" });

      // 延迟删除任务
      setTimeout(() => {
        removeTask(taskId);

        // 检查是否需要重置研究状态
        const { tasks: currentTasks, researchStatus } = useTaskStore.getState();
        const activeTasks = currentTasks.filter(
          (t) => t.type === "search" && 
                 ["processing", "searching", "summarizing", "waiting", "unprocessed"].includes(t.state)
        );

        if (activeTasks.length === 0 && researchStatus !== "idle") {
          setResearchStatus("idle");
        }
      }, 500);

      toast.success(t("research.success.taskCancelled"));
    } catch (error) {
      handleError(error);
      throw error;
    }
  }

  // 重新生成摘要
  async regenerateSummary(taskId: string): Promise<void> {
    const { tasks, updateTask } = useTaskStore.getState();
    const { networkingModel } = getModel();
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.type !== "search") {
      throw new Error(`Task with id ${taskId} not found or not a search task`);
    }

    if (!task.sources || task.sources.length === 0) {
      throw new Error("No search sources available for summary regeneration");
    }

    try {
      updateTask(taskId, { state: "summarizing" });

      const summaryResult = streamText({
        model: await createModelProvider(networkingModel),
        system: getSystemPrompt(),
        prompt: [
          regenerateSummaryPrompt(task.query, task.researchGoal, task.sources),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      let summaryContent = "";
      for await (const textPart of summaryResult.textStream) {
        summaryContent += textPart;
        updateTask(taskId, { learning: summaryContent });
      }

      updateTask(taskId, { state: "completed" });
      toast.success(t("research.success.summaryRegenerated"));
    } catch (error) {
      updateTask(taskId, { state: "failed" });
      handleError(error);
      throw error;
    }
  }

  // 取消深度研究
  async cancelDeeperResearch(): Promise<void> {
    const { tasks, setResearchStatus } = useTaskStore.getState();

    try {
      // 设置停止状态
      setResearchStatus("stopping");

      // 取消所有活动的搜索任务
      const activeTasks = tasks.filter(
        (t): t is SearchTask => 
          t.type === "search" && 
          ["processing", "searching", "summarizing", "waiting", "unprocessed"].includes(t.state)
      );

      for (const task of activeTasks) {
        await this.cancelTask(task.id);
      }

      // 重置状态
      setTimeout(() => {
        setResearchStatus("idle");
      }, 1000);

      toast.success(t("research.success.deeperResearchCancelled"));
    } catch (error) {
      setResearchStatus("idle");
      handleError(error);
      throw error;
    }
  }

  // 检查自动深度研究
  async checkAutoDeepResearch(): Promise<void> {
    const { 
      tasks, 
      researchStatus, 
      maxDepth, 
      isDepthCompleted 
    } = useTaskStore.getState();
    const { autoDeepResearch } = useSettingStore.getState();

    if (!autoDeepResearch || researchStatus !== "idle") {
      return;
    }

    // 找到当前最大深度
    const searchTasks = tasks.filter((t): t is SearchTask => t.type === "search");
    const currentMaxDepth = Math.max(
      0,
      ...searchTasks.map((t) => t.depth || 0)
    );

    // 检查当前深度是否完成且未达到最大深度
    if (
      currentMaxDepth < maxDepth &&
      isDepthCompleted(currentMaxDepth) &&
      searchTasks.filter((t) => (t.depth || 0) === currentMaxDepth && t.state === "completed").length > 0
    ) {
      // 找到最后一个完成的任务来触发深度研究
      const lastCompletedTask = searchTasks
        .filter((t) => (t.depth || 0) === currentMaxDepth && t.state === "completed")
        .sort((a, b) => b.id.localeCompare(a.id))[0];

      if (lastCompletedTask) {
        await this.runDeeperResearch(lastCompletedTask.id);
      }
    }
  }

  // 清理所有重试状态
  clearAllRetryStates(): void {
    this.retryManager.clearAllRetryStates();
  }

  // 获取重试状态统计
  getRetryStats() {
    return this.retryManager.getRetryStats();
  }

  // 私有辅助方法
  private isUserIntervened(): boolean {
    const { researchStatus } = useTaskStore.getState();
    return researchStatus === "stopping";
  }
}
