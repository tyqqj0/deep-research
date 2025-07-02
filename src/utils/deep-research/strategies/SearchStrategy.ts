import {
  ImageSource,
  ProviderOptions,
  Source,
  Tools,
  createModelProvider,
  isNetworkingModel,
} from "@/app/api/utils";
import {
  getResponseLanguagePrompt,
  getSystemPrompt,
  processResultPrompt,
  processSearchResultPrompt,
} from "@/utils/deep-research/prompts";
import { search } from "@/utils/deep-research/search";
import { getModel } from "@/utils/model";
import { ThinkTagStreamProcessor } from "@/utils/parser";
import { Plimit } from "@/utils/request";
import { searchLocalKnowledges } from "@/utils/server/knowledge";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";
import { SearchTask } from "@/types";
import { t } from "i18next";
import { getRetryState, clearRetryState } from "@/store/utils";
import { handleError } from "@/utils/error";
import * as openai from "@ai-sdk/openai";
import { streamText } from "ai";
import { RetryManager } from "../services/RetryManager";

export class SearchStrategy {
  private retryManager?: RetryManager;

  public setRetryManager(retryManager: RetryManager) {
    this.retryManager = retryManager;
  }

  async execute(queries: SearchTask[], skipAutoRetry: boolean = false): Promise<void> {
    console.log("[runSearchTask] 函数调用参数:", {
      queriesCount: queries.length,
      skipAutoRetry,
      firstTaskId: queries[0]?.id,
      firstTaskTitle: queries[0]?.title,
      stackTrace: new Error().stack?.split("\n").slice(1, 4).join("\n"),
    });
    const {
      parallelSearch,
      enableTaskWaitingTime,
      taskWaitingTime,
      searchExecutionMode,
    } = useSettingStore.getState();
    const { updateTask } = useTaskStore.getState();
    const plimit = Plimit(parallelSearch);

    await Promise.all(
      queries.map((item) => {
        plimit(async () => {
          if (searchExecutionMode === "manual") {
            updateTask(item.id, { state: "unprocessed" });
            return;
          } else if (searchExecutionMode === "delayed" && enableTaskWaitingTime) {
            updateTask(item.id, { state: "waiting" });
            const timerId = setTimeout(() => {
              this.startExecution(item, skipAutoRetry, plimit);
            }, taskWaitingTime * 1000);
            updateTask(item.id, { timerId });
          } else {
            this.startExecution(item, skipAutoRetry, plimit);
          }
        });
      })
    );
  }

  private async startExecution(item: SearchTask, skipAutoRetry: boolean, plimit: any) {
    const { searchProvider, searchErrorHandling, enableSearch, parallelSearch, searchMaxResult } = useSettingStore.getState();
    console.log("[搜索任务开始] 开始执行搜索任务:", {
      taskId: item.id,
      title: item.title,
      query: item.query,
      searchProvider,
      searchErrorHandling,
      enableSearch,
      parallelSearch,
      searchMaxResult,
      skipAutoRetry,
      existingRetryState: this.retryManager?.getRetryState(item.id),
    });

    if (!skipAutoRetry && this.retryManager) {
      const retryState = this.retryManager.getRetryState(item.id);
      if (retryState.retryCount > 0 || retryState.isAutoRetrying) {
        console.log("[搜索任务开始] 清理残留的重试状态:", retryState);
        this.retryManager.clearRetryState(item.id);
      }
    }

    let content = "";
    let reasoning = "";
    let searchResult;
    let sources: Source[] = [];
    let images: ImageSource[] = [];

    const { resources, updateTask } = useTaskStore.getState();

    try {
      if (resources.length > 0) {
        updateTask(item.id, { state: "processing" });
        const knowledges = await searchLocalKnowledges(item);
        content += [
          knowledges,
          `### ${t("research.searchResult.references")}`,
          resources.map((item) => `- ${item.name}`).join("\n"),
          "---",
          "",
        ].join("\n\n");
      }
      if (enableSearch) {
        await this.executeWithProvider(item, sources, images, plimit, skipAutoRetry);
      } else {
        updateTask(item.id, { state: "summarizing" });
        const { networkingModel } = getModel();
        searchResult = streamText({
          model: await createModelProvider(networkingModel),
          system: getSystemPrompt(),
          prompt: [
            processResultPrompt(item.query, item.researchGoal),
            getResponseLanguagePrompt(),
          ].join("\n\n"),
          onError: handleError,
        });
        await this.processStream(item.id, searchResult);
      }
    } catch (err) {
      await this.handleSearchError(err as Error, item, plimit, skipAutoRetry);
    }
  }

  private async executeWithProvider(task: SearchTask, sources: Source[], images: ImageSource[], plimit: any, skipAutoRetry: boolean) {
    const {
      provider,
      searchProvider,
      searchMaxResult,
      references,
    } = useSettingStore.getState();
    const { updateTask } = useTaskStore.getState();
    const { networkingModel } = getModel();
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();

    const createModel = (model: string) => {
      if (searchProvider === "model" && provider === "google" && isNetworkingModel(model)) {
        return createModelProvider(model, { useSearchGrounding: true });
      } else {
        return createModelProvider(model);
      }
    };

    const getTools = (model: string) => {
      if (searchProvider === "model") {
        if (["openai", "azure"].includes(provider) && model.startsWith("gpt-4o")) {
          return { web_search_preview: openai.tools.webSearchPreview({ searchContextSize: "medium" }) } as Tools;
        }
      }
      return undefined;
    };

    const getProviderOptions = (model: string) => {
      if (searchProvider === "model") {
        if (provider === "openrouter") {
          return { openrouter: { plugins: [{ id: "web", max_results: searchMaxResult }] } } as ProviderOptions;
        } else if (provider === "xai" && model.startsWith("grok-3") && !model.includes("mini")) {
          return { xai: { search_parameters: { mode: "auto", max_search_results: searchMaxResult } } } as ProviderOptions;
        }
      }
      return undefined;
    };

    let searchResult;

    if (searchProvider !== "model") {
      updateTask(task.id, { state: "searching" });
      try {
        const results = await search(task.query);
        sources = results.sources;
        images = results.images;

        if (sources.length === 0) {
          throw new Error("Invalid Search Results");
        }
      } catch (err) {
        await this.handleSearchError(err as Error, task, plimit, skipAutoRetry);
        return;
      }

      const enableReferences = sources.length > 0 && references === "enable";
      updateTask(task.id, { state: "summarizing" });
      searchResult = streamText({
        model: await createModel(networkingModel),
        system: getSystemPrompt(),
        prompt: [
          processSearchResultPrompt(
            task.query,
            task.researchGoal,
            sources,
            enableReferences
          ),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });
    } else {
      updateTask(task.id, { state: "summarizing" });
      searchResult = streamText({
        model: await createModel(networkingModel),
        system: getSystemPrompt(),
        prompt: [
          processResultPrompt(task.query, task.researchGoal),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        tools: getTools(networkingModel),
        providerOptions: getProviderOptions(networkingModel),
        onError: handleError,
      });
    }

    let content = "";
    let reasoning = "";
    for await (const delta of searchResult) {
      const { text, toolCall, toolResult } = thinkTagStreamProcessor.process(delta);
      if (text) {
        content += text;
        updateTask(task.id, { learning: content, sources, images });
      }
      if (toolCall) {
        reasoning += JSON.stringify(toolCall, null, 2);
        updateTask(task.id, { reasoning });
      }
      if (toolResult) {
        reasoning += JSON.stringify(toolResult, null, 2);
        updateTask(task.id, { reasoning });
      }
    }
    updateTask(task.id, { state: "finished" });
  }

  private async processStream(taskId: string, searchResult: any) {
    const { updateTask } = useTaskStore.getState();
    let content = "";
    for await (const delta of searchResult) {
      content += delta;
      updateTask(taskId, { learning: content });
    }
    updateTask(taskId, { state: "finished" });
  }

  private async handleSearchError(error: Error, task: SearchTask, plimit: any, skipAutoRetry: boolean) {
    const { searchProvider, searchErrorHandling } = useSettingStore.getState();
    const { updateTask } = useTaskStore.getState();

    const errorMsg = `[${searchProvider}]: ${error.message || "Search Failed"}`;
    console.error("[搜索错误] 捕获到错误:", error);

    if (searchErrorHandling === "ignore") {
      const failedContent = `❌ **${t("research.status.searchFailed")}**

**${t("research.common.query")}**: ${task.query}

**${t("research.status.searchError")}**: ${errorMsg}

*此任务因搜索错误被跳过，但其他任务将继续执行。*`;
      updateTask(task.id, { state: "failed", learning: failedContent });
      return;
    } else if (this.retryManager && searchErrorHandling === "auto" && !skipAutoRetry && !this.retryManager.getRetryState(task.id).isAutoRetrying) {
      this.retryManager.scheduleRetry(task.id, error).catch(retryError => {
        console.error("[搜索错误处理] 自动重试流程出错:", retryError);
      });
      return;
    } else if (searchErrorHandling === "auto" && (skipAutoRetry || this.retryManager?.getRetryState(task.id).isAutoRetrying)) {
      const failedContent = `❌ **${t("research.status.searchFailed")}**

**${t("research.common.query")}**: ${task.query}

**${t("research.status.searchError")}**: ${errorMsg}

*重试时搜索失败或已在重试中。*`;
      updateTask(task.id, { state: "failed", learning: failedContent });
      return;
    } else {
      const failedContent = `❌ **${t("research.status.searchFailed")}**

**${t("research.common.query")}**: ${task.query}

**${t("research.status.searchError")}**: ${errorMsg}

*搜索失败，已停止后续任务执行。需要手动处理。*`;
      updateTask(task.id, { state: "failed", learning: failedContent });
      handleError(errorMsg);
      return plimit.clearQueue();
    }
  }
}
