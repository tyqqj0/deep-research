import { useState } from "react";
import { streamText, type JSONValue, type Tool } from "ai";
import { parsePartialJson } from "@ai-sdk/ui-utils";
import { openai } from "@ai-sdk/openai";
import { type GoogleGenerativeAIProviderMetadata } from "@ai-sdk/google";
import { useTranslation } from "react-i18next";
import Plimit from "p-limit";
import { toast } from "sonner";
import useModelProvider from "@/hooks/useAiProvider";
import useWebSearch from "@/hooks/useWebSearch";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import { useSettingStore } from "@/store/setting";
import { useKnowledgeStore } from "@/store/knowledge";
import { outputGuidelinesPrompt } from "@/constants/prompts";
import {
  getSystemPrompt,
  generateQuestionsPrompt,
  writeReportPlanPrompt,
  generateSerpQueriesPrompt,
  processResultPrompt,
  processSearchResultPrompt,
  processSearchKnowledgeResultPrompt,
  reviewSerpQueriesPrompt,
  writeFinalReportPrompt,
  getSERPQuerySchema,
  planNextDeepStepPrompt,
  generateTasksFromPlanPrompt,
  extractResearchTasks,
  reflectCurrentResearchPrompt,
  extractReflectionResults,
  extractStrategicThinking,
} from "@/utils/deep-research/prompts";
import { isNetworkingModel } from "@/utils/model";
import { ThinkTagStreamProcessor, removeJsonMarkdown } from "@/utils/text";
import { parseError } from "@/utils/error";
import { pick, flat, unique } from "radash";
import { nanoid } from "nanoid";
import { z } from "zod";
import type {
  SearchTask,
  ThinkingTask,
  Knowledge,
  Source,
  ImageSource,
} from "@/types";

type ProviderOptions = Record<string, Record<string, JSONValue>>;
type Tools = Record<string, Tool>;

// const taskControllers = new Map<string, AbortController>();

function getResponseLanguagePrompt() {
  return `\n\n**Respond in the same language as the user's language**`;
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

function useDeepResearch() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const { createModelProvider, getModel } = useModelProvider();
  const { search } = useWebSearch();
  const [status, setStatus] = useState<string>("");

  async function askQuestions() {
    const { question } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [
        generateQuestionsPrompt(question),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      onError: handleError,
    });
    let content = "";
    let reasoning = "";
    taskStore.setQuestion(question);
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            taskStore.updateQuestions(content);
          },
          (data) => {
            reasoning += data;
          }
        );
      } else if (part.type === "reasoning") {
        reasoning += part.textDelta;
      }
    }
    if (reasoning) console.log(reasoning);
  }

  async function writeReportPlan() {
    const { query } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [writeReportPlanPrompt(query), getResponseLanguagePrompt()].join(
        "\n\n"
      ),
      onError: handleError,
    });
    let content = "";
    let reasoning = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            taskStore.updateReportPlan(content);
          },
          (data) => {
            reasoning += data;
          }
        );
      } else if (part.type === "reasoning") {
        reasoning += part.textDelta;
      }
    }
    if (reasoning) console.log(reasoning);
    return content;
  }

  async function searchLocalKnowledges(task: SearchTask) {
    const { resources } = useTaskStore.getState();
    const knowledgeStore = useKnowledgeStore.getState();
    const knowledges: Knowledge[] = [];

    for (const item of resources) {
      if (item.status === "completed") {
        const resource = knowledgeStore.get(item.id);
        if (resource) {
          knowledges.push(resource);
        }
      }
    }

    const { networkingModel } = getModel();
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const searchResult = streamText({
      model: await createModelProvider(networkingModel),
      system: getSystemPrompt(),
      prompt: [
        processSearchKnowledgeResultPrompt(task.query, task.researchGoal, knowledges),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      onError: handleError,
    });
    let content = "";
    let reasoning = "";
    for await (const part of searchResult.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            taskStore.updateTask(task.id, { learning: content });
          },
          (data) => {
            reasoning += data;
          }
        );
      } else if (part.type === "reasoning") {
        reasoning += part.textDelta;
      }
    }
    if (reasoning) console.log(reasoning);
    return content;
  }

  async function runSearchTask(queries: SearchTask[]) {
    const {
      provider,
      enableSearch,
      searchProvider,
      parallelSearch,
      searchMaxResult,
      references,
      enableTaskWaitingTime,
      taskWaitingTime,
      searchExecutionMode,
      searchErrorHandling,
    } = useSettingStore.getState();
    const { resources, updateTask } = useTaskStore.getState();
    const { networkingModel } = getModel();
    setStatus(t("research.common.research"));
    const plimit = Plimit(parallelSearch);
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const createModel = (model: string) => {
      // Enable Gemini's built-in search tool
      if (
        enableSearch &&
        searchProvider === "model" &&
        provider === "google" &&
        isNetworkingModel(model)
      ) {
        return createModelProvider(model, { useSearchGrounding: true });
      } else {
        return createModelProvider(model);
      }
    };
    const getTools = (model: string) => {
      // Enable OpenAI's built-in search tool
      if (enableSearch && searchProvider === "model") {
        if (
          ["openai", "azure"].includes(provider) &&
          model.startsWith("gpt-4o")
        ) {
          return {
            web_search_preview: openai.tools.webSearchPreview({
              // optional configuration:
              searchContextSize: "medium",
            }),
          } as Tools;
        }
      }
      return undefined;
    };
    const getProviderOptions = (model: string) => {
      if (enableSearch && searchProvider === "model") {
        // Enable OpenRouter's built-in search tool
        if (provider === "openrouter") {
          return {
            openrouter: {
              plugins: [
                {
                  id: "web",
                  max_results: searchMaxResult, // Defaults to 5
                },
              ],
            },
          } as ProviderOptions;
        } else if (
          provider === "xai" &&
          model.startsWith("grok-3") &&
          !model.includes("mini")
        ) {
          return {
            xai: {
              search_parameters: {
                mode: "auto",
                max_search_results: searchMaxResult,
              },
            },
          } as ProviderOptions;
        }
      }
      return undefined;
    };
    await Promise.all(
      queries.map((item) => {
        plimit(async () => {
          // Handle different search execution modes
          if (searchExecutionMode === "manual") {
            // Manual mode: just mark as unprocessed and wait for user action
            updateTask(item.id, { state: "unprocessed" });
            return;
          } else if (searchExecutionMode === "delayed" && enableTaskWaitingTime) {
            // Delayed mode: use waiting time
            updateTask(item.id, { state: "waiting" });
            const timerId = setTimeout(() => {
              startExecution(item);
            }, taskWaitingTime * 1000);
            updateTask(item.id, { timerId });
          } else {
            // Immediate mode: start execution right away
            startExecution(item);
          }
        });
      })
    );

    async function startExecution(item: SearchTask) {
      console.log("[搜索任务开始] 开始执行搜索任务:", {
        taskId: item.id,
        title: item.title,
        query: item.query,
        searchProvider,
        searchErrorHandling,
        enableSearch,
        parallelSearch,
        searchMaxResult
      });
      
      let content = "";
      let reasoning = "";
      let searchResult;
      let sources: Source[] = [];
      let images: ImageSource[] = [];

      // const controller = new AbortController();
      // taskControllers.set(item.id, controller);

      try {
        if (resources.length > 0) {
          updateTask(item.id, { state: "processing" });
          const knowledges = await searchLocalKnowledges(
            item
          );
          content += [
            knowledges,
            `### ${t("research.searchResult.references")}`,
            resources.map((item) => `- ${item.name}`).join("\n"),
            "---",
            "",
          ].join("\n\n");
        }
        if (enableSearch) {
          console.log("[搜索任务] 搜索功能已启用，开始搜索流程:", {
            taskId: item.id,
            searchProvider,
            query: item.query
          });
          
          if (searchProvider !== "model") {
            console.log("[搜索任务] 使用外部搜索提供商:", searchProvider);
            try {
              console.log("[搜索任务] 更新任务状态为 'searching'");
              updateTask(item.id, { state: "searching" });
              
              console.log("[搜索任务] 调用搜索接口:", {
                query: item.query,
                searchProvider
              });
              const results = await search(item.query);
              console.log("[搜索任务] 搜索接口返回结果:", {
                sourcesCount: results.sources.length,
                imagesCount: results.images.length,
                sources: results.sources.map(s => ({ title: s.title, url: s.url }))
              });
              
              sources = results.sources;
              images = results.images;

              if (sources.length === 0) {
                console.log("[搜索任务] 搜索结果为空，将抛出错误");
                throw new Error("Invalid Search Results");
              }
              
              console.log("[搜索任务] 搜索成功，获得", sources.length, "个结果");
            } catch (err) {
              console.error("[搜索错误] 捕获到错误:", err);
              console.error("[搜索错误] 错误类型:", typeof err);
              console.error("[搜索错误] 错误堆栈:", err instanceof Error ? err.stack : "无堆栈信息");
              
              const errorMsg = `[${searchProvider}]: ${err instanceof Error ? err.message : "Search Failed"}`;
              
              console.log("[搜索错误处理] 当前配置:", {
                searchErrorHandling,
                taskId: item.id,
                taskTitle: item.title,
                query: item.query,
                searchProvider,
                errorMsg
              });
              
              if (searchErrorHandling === "ignore") {
                // 忽略错误：标记任务失败但显示查询信息，不停止其他任务
                const failedContent = `❌ **${t("research.status.searchFailed")}**\n\n**${t("research.common.query")}**: ${item.query}\n\n**${t("research.status.searchError")}**: ${errorMsg}\n\n*此任务因搜索错误被跳过，但其他任务将继续执行。*`;
                
                console.log("[搜索错误处理] 忽略模式 - 更新任务状态为failed:", {
                  taskId: item.id,
                  failedContent
                });
                
                updateTask(item.id, {
                  state: "failed",
                  learning: failedContent
                });
                
                console.log(`[搜索错误处理] ✅ 忽略模式完成：任务 ${item.id} 已标记为失败，继续执行其他任务`);
                return; // 不阻止其他任务，只返回当前任务
              } else {
                // 自动处理：显示错误信息在任务中，同时显示toast并停止队列
                const failedContent = `❌ **${t("research.status.searchFailed")}**\n\n**${t("research.common.query")}**: ${item.query}\n\n**${t("research.status.searchError")}**: ${errorMsg}\n\n*搜索失败，已停止后续任务执行。*`;
                
                console.log("[搜索错误处理] 自动处理模式 - 更新任务状态并显示错误:", {
                  taskId: item.id,
                  failedContent
                });
                
                updateTask(item.id, {
                  state: "failed", 
                  learning: failedContent
                });
                
                console.log("[搜索错误处理] 自动处理模式 - 显示错误toast并停止队列:", errorMsg);
                handleError(errorMsg);
                console.log("[搜索错误处理] ✅ 自动处理模式完成：已更新任务状态、显示toast并清空队列");
                return plimit.clearQueue();
              }
            }
            const enableReferences =
              sources.length > 0 && references === "enable";
            updateTask(item.id, { state: "summarizing" });
            searchResult = streamText({
              model: await createModel(networkingModel),
              system: getSystemPrompt(),
              prompt: [
                processSearchResultPrompt(
                  item.query,
                  item.researchGoal,
                  sources,
                  enableReferences
                ),
                getResponseLanguagePrompt(),
              ].join("\n\n"),
              // signal: controller.signal,
              onError: handleError,
            });
          } else {
            updateTask(item.id, { state: "summarizing" });
            searchResult = streamText({
              model: await createModel(networkingModel),
              system: getSystemPrompt(),
              prompt: [
                processResultPrompt(item.query, item.researchGoal),
                getResponseLanguagePrompt(),
              ].join("\n\n"),
              tools: getTools(networkingModel),
              providerOptions: getProviderOptions(networkingModel),
              // signal: controller.signal,
              onError: handleError,
            });
          }
        } else {
          updateTask(item.id, { state: "summarizing" });
          searchResult = streamText({
            model: await createModelProvider(networkingModel),
            system: getSystemPrompt(),
            prompt: [
              processResultPrompt(item.query, item.researchGoal),
              getResponseLanguagePrompt(),
            ].join("\n\n"),
            // signal: controller.signal,
            onError: (err: any) => {
              updateTask(item.id, { state: "failed" });
              handleError(err);
            },
          });
        }
        for await (const part of searchResult.fullStream) {
          // if (controller.signal.aborted) {
          //   updateTask(item.id, { state: "cancelled" });
          //   break;
          // }
          if (part.type === "text-delta") {
            thinkTagStreamProcessor.processChunk(
              part.textDelta,
              (data) => {
                content += data;
                updateTask(item.id, { learning: content });
              },
              (data) => {
                reasoning += data;
              }
            );
          } else if (part.type === "reasoning") {
            reasoning += part.textDelta;
          } else if (part.type === "source") {
            sources.push(part.source);
          } else if (part.type === "finish") {
            if (part.providerMetadata?.google) {
              const { groundingMetadata } = part.providerMetadata.google;
              const googleGroundingMetadata =
                groundingMetadata as GoogleGenerativeAIProviderMetadata["groundingMetadata"];
              if (googleGroundingMetadata?.groundingSupports) {
                googleGroundingMetadata.groundingSupports.forEach(
                  ({ segment, groundingChunkIndices }) => {
                    if (segment.text && groundingChunkIndices) {
                      const index = groundingChunkIndices.map(
                        (idx: number) => `[${idx + 1}]`
                      );
                      content = content.replaceAll(
                        segment.text,
                        `${segment.text}${index.join("")}`
                      );
                    }
                  }
                );
              }
            } else if (part.providerMetadata?.openai) {
              // Fixed the problem that OpenAI cannot generate markdown reference link syntax properly in Chinese context
              content = content.replaceAll("【", "[").replaceAll("】", "]");
            }
          }
        }
        if (reasoning) console.log(reasoning);

        if (sources.length > 0) {
          content +=
            "\n\n" +
            sources
              .map(
                (item, idx) =>
                  `[${idx + 1}]: ${item.url}${item.title ? ` "${item.title.replaceAll('"', " ")}"` : ""
                  }`
              )
              .join("\n");
        }
        updateTask(item.id, {
          state: "completed",
          learning: content,
          sources,
          images,
        });

        // 任务完成后，检查是否应该自动启动下一层研究
        setTimeout(() => {
          checkAutoDeepResearch();
        }, 1000);

        return content;
      } finally {
        // taskControllers.delete(item.id);
      }
    }
  }

  async function runWiderResearch() {
    const {
      reportPlan,
      tasks,
      suggestion,
      researchStatus,
      setResearchStatus,
    } = useTaskStore.getState();

    // 添加状态检查
    if (researchStatus === "deeper-research") {
      toast.warning(t("research.common.deeperResearchInProgress"));
      return;
    }

    setResearchStatus("wider-research");

    try {
      const { thinkingModel } = getModel();
      setStatus(t("research.common.research"));
      const learnings = tasks
        .filter((item): item is SearchTask => item.type === "search")
        .map((item) => item.learning);
      const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
      const result = streamText({
        model: await createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          reviewSerpQueriesPrompt(reportPlan, learnings, suggestion),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      const querySchema = getSERPQuerySchema();
      let content = "";
      let reasoning = "";
      let queries: SearchTask[] = [];
      for await (const textPart of result.textStream) {
        thinkTagStreamProcessor.processChunk(
          textPart,
          (text) => {
            content += text;
            const data = parsePartialJson(
              removeJsonMarkdown(content)
            );
            if (
              querySchema.safeParse(data.value) &&
              data.state === "successful-parse"
            ) {
              if (data.value) {
                queries = (data.value as any).map(
                  (item: {
                    query: string;
                    title: string;
                    researchGoal: string;
                  }) => {
                    const researchGoal = item.researchGoal || "";
                    // Priority 1: Use AI-generated title if available and not empty.
                    // Priority 2: Extract the first sentence of researchGoal as the title.
                    // Priority 3: Fallback to query if title is still empty.
                    const title =
                      item.title?.trim() ||
                      researchGoal.split(/[.!?。！？]/)[0].trim() ||
                      item.query;

                    return {
                      type: "search" as const,
                      query: item.query,
                      researchGoal: researchGoal,
                      title: title,
                      state: "unprocessed",
                      learning: "",
                      sources: [],
                      images: [],
                    };
                  }
                );
              }
            }
          },
          (text) => {
            reasoning += text;
          }
        );
      }
      if (reasoning) console.log(reasoning);
      if (queries.length > 0) {
        const newTasks = queries.map((q) => ({ ...q, id: nanoid() }));
        taskStore.update([...tasks, ...newTasks]);
        await runSearchTask(newTasks);
      }
    } finally {
      setResearchStatus("idle");
    }
  }

  async function runDeeperResearch(taskId: string) {
    console.log(`[DEBUG_CORE] runDeeperResearch called for taskId: ${taskId}`);
    const {
      researchStatus,
      tasks,
      addTasks,
      updateTask,
      removeTask,
      setResearchStatus,
      setCurrentDepth,
    } = useTaskStore.getState();

    // 获取设置中的最大深度
    const { maxResearchDepth } = useSettingStore.getState();
    const maxDepth = maxResearchDepth;
    const { thinkingModel } = getModel();

    // 如果研究正在进行，则直接退出
    if (researchStatus === "deeper-research") {
      console.log(
        `[DEBUG_CORE] Aborting: researchStatus is already 'deeper-research'.`
      );
      return;
    }

    const lastTask = tasks.find((t) => t.id === taskId) as SearchTask;
    if (!lastTask) {
      console.error(
        `[DEBUG_CORE] Aborting: lastTask with id ${taskId} not found.`
      );
      return;
    }
    console.log(`[DEBUG_CORE] Found lastTask:`, lastTask);

    // 步骤 2：设置状态
    setResearchStatus("deeper-research");
    console.log(`[DEBUG_CORE] researchStatus set to 'deeper-research'.`);

    try {
      let currentMaxDepth = lastTask.depth;
      console.log(`[DEBUG_CORE] 循环开始条件检查:`, {
        currentMaxDepth,
        maxDepth,
        researchStatus: useTaskStore.getState().researchStatus,
        shouldEnterLoop: currentMaxDepth < maxDepth && useTaskStore.getState().researchStatus === "deeper-research"
      });

      while (
        currentMaxDepth < maxDepth &&
        useTaskStore.getState().researchStatus === "deeper-research"
      ) {
        setStatus(t("research.common.deeperResearch"));
        setCurrentDepth(currentMaxDepth);

        // 步骤 5：检查是否已有 thinking task
        const existingThinking = tasks.find(
          (t) => t.type === "thinking" && t.depth === currentMaxDepth + 1
        );

        if (existingThinking) {
          console.log(
            "【REUSE_THINKING】Found existing thinking task for depth",
            currentMaxDepth + 1,
            "- Status:",
            existingThinking.state
          );

          // 如果thinking task已完成，检查是否有对应的搜索任务
          if (existingThinking.state === "completed") {
            const correspondingSearchTasks = tasks.filter(
              (t): t is SearchTask =>
                t.type === "search" &&
                t.depth === currentMaxDepth + 1
            );

            console.log(
              "【REUSE_THINKING】Found",
              correspondingSearchTasks.length,
              "search tasks for this depth"
            );

            // 如果有搜索任务，跳过这一层，继续下一层
            if (correspondingSearchTasks.length > 0) {
              console.log("【REUSE_THINKING】Search tasks exist, moving to next depth");
              currentMaxDepth++;
              continue;
            } else {
              // 如果没有搜索任务，说明thinking task可能是残留的，删除它重新开始
              console.log("【REUSE_THINKING】No search tasks found, removing orphaned thinking task");
              removeTask(existingThinking.id);
            }
          } else {
            // 如果thinking task还在处理中，等待它完成或者删除重新开始
            console.log("【REUSE_THINKING】Thinking task is still processing, skipping this iteration");
            break;
          }
        }

        // 步骤 6：获取当前层的学习内容
        const learningsAtCurrentDepth = tasks
          .filter(
            (t): t is SearchTask =>
              t.type === "search" &&
              ((t as { depth?: number }).depth || 0) === currentMaxDepth &&
              t.state === "completed"
          )
          .map((t) => t.learning);

        console.log(
          "【检查点 4】在当前深度寻找到的学习成果数量:",
          learningsAtCurrentDepth.length
        );
        console.log("【DEBUG_DEPTH】当前深度变量:", {
          currentMaxDepth,
          lastTaskDepth: lastTask.depth,
          maxDepth,
          tasksCount: tasks.length,
          searchTasksAtCurrentDepth: tasks.filter(t =>
            t.type === "search" && ((t as any).depth || 0) === currentMaxDepth
          ).length,
          completedSearchTasksAtCurrentDepth: tasks.filter(t =>
            t.type === "search" &&
            ((t as any).depth || 0) === currentMaxDepth &&
            (t as any).state === "completed"
          ).length
        });

        if (learningsAtCurrentDepth.length > 0) {
          console.log("  - 找到的学习成果:", learningsAtCurrentDepth);
        }

        if (learningsAtCurrentDepth.length === 0) {
          console.warn(
            "【退出循环】在当前深度未找到任何已完成的学习成果。",
            "可能的原因：1) 任务深度不匹配，2) 任务状态不是completed，3) 没有learning内容"
          );
          break; // Exit loop
        }

        // 步骤 7：先创建 thinking task（processing状态）
        console.log("【检查点 5】创建thinking task...");
        const thinkingTaskId = nanoid();
        const thinkingTask: ThinkingTask = {
          id: thinkingTaskId,
          type: "thinking",
          depth: currentMaxDepth + 1,
          title: `第 ${currentMaxDepth + 1} 层思考过程`,
          reasoning: "",
          state: "processing",
        };

        // 立即添加thinking task让用户看到
        addTasks([thinkingTask]);

        // 步骤 8：三阶段AI生成过程

        // 8.1 第一阶段：反思评估（流式更新reflection）
        console.log("【检查点 6-1】开始第一阶段：反思评估...");
        const { question } = useTaskStore.getState(); // 获取原始研究主题

        const reflectionResult = streamText({
          model: await createModelProvider(thinkingModel),
          system: getSystemPrompt(),
          prompt: [
            reflectCurrentResearchPrompt(question, learningsAtCurrentDepth, currentMaxDepth),
            getResponseLanguagePrompt(),
          ].join("\n\n"),
          onError: handleError,
        });

        let reflectionContent = "";
        for await (const textPart of reflectionResult.textStream) {
          reflectionContent += textPart;

          // 实时更新thinking task的reflection，保持思考状态
          updateTask(thinkingTaskId, {
            reflection: reflectionContent,
            state: "processing" as const
          });
        }

        // 8.2 解析反思结果
        const reflectionResults = extractReflectionResults(reflectionContent);
        updateTask(thinkingTaskId, {
          completionStatus: reflectionResults.completionStatus || undefined,
          researchGaps: reflectionResults.researchGaps
        });

        console.log("【反思结果】", reflectionResults);

        // 如果研究已完成，则停止深度研究
        if (reflectionResults.completionStatus === 'RESEARCH_COMPLETE') {
          updateTask(thinkingTaskId, {
            reasoning: "🎯 " + t("research.thinking.researchComplete"),
            state: "completed"
          });
          console.log("【研究完成】目标已达成，停止深度研究");
          break;
        }

        // 8.3 第二阶段：战略思考（流式更新strategicThinking）
        console.log("【检查点 6-2】开始第二阶段：战略思考...");
        const { deepSearchMaxTasks } = useSettingStore.getState(); // 从设置中获取任务数量

        const strategicThinkingResult = streamText({
          model: await createModelProvider(thinkingModel),
          system: getSystemPrompt(),
          prompt: [
            planNextDeepStepPrompt(question, learningsAtCurrentDepth, reflectionContent, deepSearchMaxTasks),
            getResponseLanguagePrompt(),
          ].join("\n\n"),
          onError: handleError,
        });

        let strategicThinkingContent = "";
        for await (const textPart of strategicThinkingResult.textStream) {
          strategicThinkingContent += textPart;

          // 实时更新thinking task的strategicThinking
          updateTask(thinkingTaskId, {
            strategicThinking: strategicThinkingContent,
            state: "processing" as const
          });
        }

        // 8.4 提取研究任务规划内容
        const researchTasksContent = extractResearchTasks(strategicThinkingContent);
        const strategicThinkingExtracted = extractStrategicThinking(strategicThinkingContent);

        console.log("【检查点 6-3】提取到的研究任务规划:", researchTasksContent);
        console.log("【检查点 6-3】提取到的战略思考:", strategicThinkingExtracted);

        if (!researchTasksContent) {
          updateTask(thinkingTaskId, {
            reasoning: "❌ " + t("research.error.taskGenerationFailed"),
            state: "completed"
          });
          toast.error(t("research.error.aiFailedToGeneratePlan"));
          break;
        }

        // 8.5 第三阶段：生成严格格式的任务
        console.log("【检查点 6-4】开始第三阶段：生成严格格式任务...");
        updateTask(thinkingTaskId, {
          reasoning: "🔄 " + t("research.thinking.generatingSearchTasks") + "...",
          state: "processing" as const
        });

        const taskGenerationResult = streamText({
          model: await createModelProvider(thinkingModel),
          system: getSystemPrompt(),
          prompt: [
            generateTasksFromPlanPrompt(strategicThinkingContent, question),
            getResponseLanguagePrompt(),
          ].join("\n\n"),
          onError: handleError,
        });

        let taskContent = "";
        let deepStepResult: { query: string; title: string; researchGoal: string }[] = [];
        let currentTaskCount = 0;

        let generatedTasks: SearchTask[] = [];

        for await (const textPart of taskGenerationResult.textStream) {
          taskContent += textPart;

          // 尝试解析JSON任务列表，支持流式生成
          const cleanedContent = removeJsonMarkdown(taskContent);
          const data = parsePartialJson(cleanedContent);
          const taskSchema = getSERPQuerySchema();
          const parseResult = taskSchema.safeParse(data.value);

          if (taskContent.length % 500 === 0 || data.state === "successful-parse") {
            console.log("【流式PARSE】当前内容长度:", taskContent.length);
            console.log("【流式PARSE】解析状态:", data.state);
            console.log("【流式PARSE】解析值类型:", typeof data.value, Array.isArray(data.value));
          }

          // 使用类似deepResearch的流式更新策略
          if (parseResult.success && Array.isArray(data.value)) {
            if (data.state === "repaired-parse" || data.state === "successful-parse") {
              const newTasks = data.value as { query: string; title: string; researchGoal: string }[];

              // 过滤并创建有效的搜索任务
              const validTasks = newTasks.filter(task =>
                task.query && task.title && task.researchGoal &&
                task.query.length > 5 && task.researchGoal.length > 10
              );

              if (validTasks.length > 0) {
                // 转换为SearchTask格式
                generatedTasks = validTasks.map((task) => {
                  const researchGoal = task.researchGoal || "";
                  const title = task.title?.trim() ||
                    researchGoal.split(/[.!?。！？]/)[0].trim() ||
                    task.query;

                  return {
                    id: nanoid(),
                    type: "search" as const,
                    query: task.query,
                    researchGoal: researchGoal,
                    title: title,
                    state: "unprocessed" as const,
                    learning: "",
                    sources: [],
                    images: [],
                    depth: currentMaxDepth + 1,
                  };
                });

                // 获取当前所有任务，过滤掉当前深度的search任务，然后添加新生成的任务
                const { tasks: currentTasks } = useTaskStore.getState();
                const otherTasks = currentTasks.filter(t =>
                  !(t.type === "search" && (t as SearchTask).depth === currentMaxDepth + 1)
                );

                // 更新任务列表（类似deepResearch的方式）
                useTaskStore.getState().update([...otherTasks, ...generatedTasks]);

                console.log(`【流式更新任务】生成了 ${generatedTasks.length} 个任务`);
                currentTaskCount = generatedTasks.length;
              }
            }
          }

          // 实时更新thinking task状态
          let progressInfo = t("research.thinking.generatingTasks");
          if (currentTaskCount > 0) {
            progressInfo = t("research.thinking.tasksGenerated", { count: currentTaskCount });
          } else if (taskContent.length > 100) {
            progressInfo = t("research.thinking.generatingTasks") + ` (${taskContent.length} chars)`;
          }

          updateTask(thinkingTaskId, {
            reasoning: strategicThinkingContent + "\n\n🔄 " + progressInfo + "...",
            state: "processing" as const
          });
        }

        deepStepResult = generatedTasks.map(task => ({
          query: task.query,
          title: task.title,
          researchGoal: task.researchGoal
        }));

        // 如果流式解析没有生成任何任务，尝试最终解析
        if (deepStepResult.length === 0 && taskContent.trim()) {
          console.log("【最终兜底解析】流式解析未生成任务，尝试完整解析...");
          console.log("【最终兜底解析】任务内容长度:", taskContent.length);

          const cleanedContent = removeJsonMarkdown(taskContent);
          const data = parsePartialJson(cleanedContent);
          const taskSchema = getSERPQuerySchema();
          const parseResult = taskSchema.safeParse(data.value);

          if (parseResult.success && Array.isArray(data.value)) {
            const finalTasks = data.value as { query: string; title: string; researchGoal: string }[];
            console.log("【最终兜底解析】找到任务数量:", finalTasks.length);

            const validFinalTasks = finalTasks.filter(task =>
              task.query && task.title && task.researchGoal &&
              task.query.length > 5 && task.researchGoal.length > 10
            );

            if (validFinalTasks.length > 0) {
              // 创建搜索任务
              const finalSearchTasks = validFinalTasks.map(task => ({
                id: nanoid(),
                type: "search" as const,
                query: task.query,
                researchGoal: task.researchGoal,
                title: task.title,
                state: "unprocessed" as const,
                learning: "",
                sources: [],
                images: [],
                depth: currentMaxDepth + 1,
              }));

              // 添加到任务列表
              const { tasks: currentTasks } = useTaskStore.getState();
              const otherTasks = currentTasks.filter(t =>
                !(t.type === "search" && (t as SearchTask).depth === currentMaxDepth + 1)
              );
              useTaskStore.getState().update([...otherTasks, ...finalSearchTasks]);

              deepStepResult = validFinalTasks;
              console.log("【最终兜底解析】成功添加任务:", validFinalTasks.length);
            }
          }
        }

        if (deepStepResult.length === 0) {
          // AI生成失败，标记thinking task为失败状态
          console.error("【任务生成失败】详细信息:", {
            taskContentLength: taskContent.length,
            taskContentPreview: taskContent.substring(0, 500),
            strategicThinkingContentLength: strategicThinkingContent.length,
            researchTasksContent: extractResearchTasks(strategicThinkingContent)
          });

          updateTask(thinkingTaskId, {
            reasoning: strategicThinkingContent + "\n\n❌ " + t("research.error.taskGenerationFailed") +
              "\n\n调试信息：\n- 任务内容长度: " + taskContent.length +
              "\n- 规划内容长度: " + strategicThinkingContent.length +
              "\n- 提取的研究任务: " + (extractResearchTasks(strategicThinkingContent) || "未找到"),
            state: "completed"
          });
          toast.error(t("research.error.aiFailedToGeneratePlan"));
          break;
        }

        // 步骤 9：标记thinking task完成（任务已经流式添加到store了）
        const tasksListText = deepStepResult.map((task, idx) =>
          `${idx + 1}. **${task.title}**\n   - ${t("research.common.query")}: ${task.query}\n   - ${t("research.common.goal")}: ${task.researchGoal}`
        ).join("\n");

        const finalReasoning = "✅ **" + t("research.thinking.generatedSearchTasks") + ":**\n" + tasksListText;

        updateTask(thinkingTaskId, {
          reasoning: finalReasoning,
          strategicThinking: strategicThinkingExtracted, // 更新为提取的战略思考内容
          state: "completed"
        });

        // 步骤 10：获取已添加的search tasks（已经通过流式更新添加到store了）
        const addedTasks = useTaskStore.getState().tasks.filter(
          (t): t is SearchTask =>
            t.type === "search" &&
            t.depth === currentMaxDepth + 1 &&
            t.state === "unprocessed"
        );

        console.log("【执行搜索】找到待执行任务数量:", addedTasks.length);

        // 步骤 11：执行搜索任务
        if (addedTasks.length > 0) {
          await runSearchTask(addedTasks);
        }

        // 步骤 12：等待当前层完成
        await waitForDepthCompletion(currentMaxDepth + 1);

        // 步骤 13：检查是否被中断
        const { researchStatus: currentStatus } = useTaskStore.getState();
        if (currentStatus === "stopping") {
          break;
        }

        // 步骤 14：移动到下一层
        currentMaxDepth++;
      }
      console.log("【检查点 6】'while' 循环已结束。");

      setStatus(t("research.common.researchCompleted"));
    } catch (error) {
      console.error("Deep research error:", error);
      handleError(error);
    } finally {
      // 步骤 15：重置状态
      setResearchStatus("idle");
    }
  }

  // 等待某一层完成的辅助函数
  async function waitForDepthCompletion(depth: number): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const { isDepthCompleted, researchStatus } = useTaskStore.getState();

        if (researchStatus === "stopping" || isDepthCompleted(depth)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  }

  // 检查是否应该自动启动下一层研究
  async function checkAutoDeepResearch() {
    const { tasks, maxDepth, researchStatus } = useTaskStore.getState();

    // 如果已经在研究中，则不触发
    if (researchStatus !== "idle") {
      return;
    }

    // 按深度分组任务
    const tasksByDepth: { [depth: number]: (SearchTask | ThinkingTask)[] } = {};
    tasks.forEach(task => {
      const depth = task.type === "thinking" ? (task as ThinkingTask).depth : (task as SearchTask).depth;
      if (!tasksByDepth[depth]) {
        tasksByDepth[depth] = [];
      }
      tasksByDepth[depth].push(task);
    });

    // 找到最大深度
    const currentMaxDepth = Math.max(...Object.keys(tasksByDepth).map(Number), 0);

    // 检查是否达到最大深度限制
    if (currentMaxDepth >= maxDepth) {
      console.log("【自动深度研究】已达到最大深度限制:", currentMaxDepth, ">=", maxDepth);
      return;
    }

    // 检查当前最大深度的搜索任务是否全部完成
    const currentDepthTasks = tasksByDepth[currentMaxDepth] || [];
    const searchTasks = currentDepthTasks.filter(t => t.type === "search") as SearchTask[];

    if (searchTasks.length === 0) {
      console.log("【自动深度研究】当前深度没有搜索任务");
      return;
    }

    const allCompleted = searchTasks.every(t => t.state === "completed");
    const hasLearning = searchTasks.some(t => t.learning && t.learning.trim().length > 50);

    // 检查是否已有thinking task在当前深度+1
    const nextDepthThinking = tasks.find(t =>
      t.type === "thinking" && (t as ThinkingTask).depth === currentMaxDepth + 1
    );

    if (allCompleted && hasLearning && !nextDepthThinking) {
      console.log("【自动深度研究】触发条件满足，自动启动下一层研究");
      console.log(`  - 当前深度: ${currentMaxDepth}`);
      console.log(`  - 已完成搜索任务: ${searchTasks.length}`);
      console.log(`  - 有学习内容的任务: ${searchTasks.filter(t => t.learning && t.learning.trim().length > 50).length}`);

      // 找到一个已完成的搜索任务作为触发点
      const completedTask = searchTasks.find(t => t.state === "completed");
      if (completedTask) {
        // 延迟一点时间再触发，避免状态冲突
        setTimeout(() => {
          console.log("【自动深度研究】开始执行自动深度研究");
          runDeeperResearch(completedTask.id);
        }, 2000);
      }
    } else {
      console.log("【自动深度研究】触发条件未满足:", {
        allCompleted,
        hasLearning,
        searchTasksCount: searchTasks.length,
        completedCount: searchTasks.filter(t => t.state === "completed").length,
        hasNextDepthThinking: !!nextDepthThinking
      });
    }
  }

  // 取消深度研究的函数
  async function cancelDeeperResearch() {
    const { setResearchStatus, tasks } = useTaskStore.getState();

    setResearchStatus("stopping");

    // 取消所有活动任务
    const activeTasks = tasks.filter(
      (t) =>
        t.type === "search" &&
        ["processing", "searching", "summarizing", "waiting"].includes(t.state as string)
    );

    for (const task of activeTasks) {
      await cancelTask(task.id);
    }

    setResearchStatus("idle");
  }

  async function writeFinalReport() {
    const { citationImage, references } = useSettingStore.getState();
    const {
      reportPlan,
      tasks,
      setId,
      setTitle,
      setSources,
      requirement,
      updateFinalReport,
    } = useTaskStore.getState();
    const { save } = useHistoryStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.writing"));
    updateFinalReport("");
    setTitle("");
    setSources([]);
    const completedSearchTasks = tasks
      .filter((item): item is SearchTask => item.type === "search" && item.state === "completed");
    
    console.log("【最终报告】搜索任务统计:", {
      totalTasks: tasks.length,
      searchTasks: tasks.filter(t => t.type === "search").length,
      completedSearchTasks: completedSearchTasks.length,
      tasksByDepth: completedSearchTasks.reduce((acc, task) => {
        const depth = task.depth || 0;
        acc[depth] = (acc[depth] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    });
    
    const learnings = completedSearchTasks
      .map((item) => item.learning)
      .filter((learning) => learning && learning.trim().length > 0);
    
    console.log("【最终报告】学习内容统计:", {
      learningsCount: learnings.length,
      averageLearningLength: learnings.length > 0 ? Math.round(learnings.reduce((sum, l) => sum + l.length, 0) / learnings.length) : 0,
      totalLearningChars: learnings.reduce((sum, l) => sum + l.length, 0)
    });
    const sources: Source[] = unique(
      flat(
        tasks
          .filter((item): item is SearchTask => item.type === "search" && item.state === "completed")
          .map((item) => item.sources || [])
      ),
      (item) => item.url
    );
    const images: ImageSource[] = unique(
      flat(
        tasks
          .filter((item): item is SearchTask => item.type === "search" && item.state === "completed")
          .map((item) => item.images || [])
      ),
      (item) => item.url
    );
    const enableCitationImage = images.length > 0 && citationImage === "enable";
    const enableReferences = sources.length > 0 && references === "enable";
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      system: [getSystemPrompt(), outputGuidelinesPrompt].join("\n\n"),
      prompt: [
        writeFinalReportPrompt(
          reportPlan,
          learnings,
          enableReferences ? sources.map((item) => pick(item, ["title", "url"])) : [],
          enableCitationImage ? images : [],
          requirement,
          enableCitationImage,
          enableReferences
        ),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      onError: handleError,
    });
    let content = "";
    let reasoning = "";
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            updateFinalReport(content);
          },
          (data) => {
            reasoning += data;
          }
        );
      } else if (part.type === "reasoning") {
        reasoning += part.textDelta;
      }
    }
    if (reasoning) console.log(reasoning);
    if (sources.length > 0) {
      content +=
        "\n\n" +
        sources
          .map(
            (item, idx) =>
              `[${idx + 1}]: ${item.url}${item.title ? ` "${item.title.replaceAll('"', " ")}"` : ""
              }`
          )
          .join("\n");
      updateFinalReport(content);
    }
    const title = (content || "")
      .split("\n")[0]
      .replaceAll("#", "")
      .replaceAll("*", "")
      .trim();
    setTitle(title);
    setSources(sources);
    const id = save(taskStore.backup());
    setId(id);
    return content;
  }

  async function cancelTask(taskId: string) {
    const { updateTask, tasks, removeTask, setResearchStatus } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId);

    if (task && task.type === "search" && task.timerId) {
      clearTimeout(task.timerId);
    }

    // const controller = taskControllers.get(taskId);
    // if (controller) {
    //   controller.abort();
    //   taskControllers.delete(taskId);
    // }
    updateTask(taskId, { state: "cancelled" });
    setTimeout(() => {
      removeTask(taskId);

      // 检查是否还有活动任务，如果没有则重置研究状态
      const remainingTasks = useTaskStore.getState().tasks;
      const hasActiveResearch = remainingTasks.some(t =>
        (t.type === "thinking" && (t as any).state === "processing") ||
        (t.type === "search" && ["processing", "searching", "summarizing", "waiting"].includes((t as any).state))
      );

      if (!hasActiveResearch) {
        setResearchStatus("idle");
      }
    }, 300);
  }

  async function rerunTask(taskId: string) {
    const { tasks, updateTask } = useTaskStore.getState();
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.type === "search") {
      // Manually cancel without deleting
      if (task.timerId) {
        clearTimeout(task.timerId);
      }
      // const controller = taskControllers.get(taskId);
      // if (controller) {
      //   controller.abort();
      //   taskControllers.delete(taskId);
      // }
      const updatedTask = { ...task, state: 'unprocessed' as const, learning: '', sources: [], images: [] };
      updateTask(taskId, { state: 'unprocessed', learning: '', timerId: undefined, sources: [], images: [] });
      await runSearchTask([updatedTask]);
    }
  }

  async function regenerateAndRerunTask(taskId: string) {
    const { tasks, reportPlan, updateTask } = useTaskStore.getState();
    const { thinkingModel } = getModel();

    const taskToRegenerate = tasks.find((t) => t.id === taskId);
    if (!taskToRegenerate) {
      toast.error("Task not found.");
      return;
    }

    // Cancel any pending execution first
    if (taskToRegenerate.type === "search" && taskToRegenerate.timerId) {
      clearTimeout(taskToRegenerate.timerId);
    }

    updateTask(taskId, { state: "processing", learning: "" }); // Show immediate feedback
    setStatus(t("research.common.thinking"));

    const otherTasksLearnings = tasks
      .filter(
        (t): t is SearchTask =>
          t.id !== taskId && t.type === "search" && t.state === "completed"
      )
      .map((t) => `Topic: ${t.title}\n${t.learning}`)
      .join("\n\n---\n\n");

    const prompt = `You are a research assistant. The user has updated the topic for a research task. Your goal is to regenerate a specific, machine-friendly search query and a detailed research goal based on this new topic.
Consider the original high-level research plan and the findings from other completed tasks for context.

Original Research Plan:
${reportPlan}

Findings from other tasks:
${otherTasksLearnings}

The user has provided a new title for this task:
New Title: ${taskToRegenerate.title}

Based on the new title and the overall research context, generate a new search query and a new research goal. The search query should be optimized for a web search engine. The research goal should be a clear and concise paragraph outlining what information to find.

Respond with a single JSON object with two keys: "query" and "researchGoal". Do not include any other text or markdown formatting.`;

    try {
      const result = await streamText({
        model: await createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: prompt,
        onError: handleError,
      });

      const RegeneratedTaskSchema = z.object({
        query: z
          .string()
          .describe("The new, specific, machine-friendly search query."),
        researchGoal: z.string().describe("The new, detailed research goal."),
      });

      let content = "";
      let regeneratedData:
        | { query: string; researchGoal: string }
        | undefined;

      for await (const textPart of result.textStream) {
        content += textPart;
        const data = parsePartialJson(
          removeJsonMarkdown(content)
        );
        if (
          RegeneratedTaskSchema.safeParse(data.value) &&
          (data.state === "repaired-parse" ||
            data.state === "successful-parse")
        ) {
          regeneratedData = data.value as { query: string; researchGoal: string };
        }
      }

      if (regeneratedData) {
        updateTask(taskId, {
          query: regeneratedData.query,
          researchGoal: regeneratedData.researchGoal,
          state: "unprocessed",
          learning: "",
          sources: [],
          images: [],
        });
        const updatedTask = useTaskStore
          .getState()
          .tasks.find((t) => t.id === taskId);
        if (updatedTask && updatedTask.type === "search") {
          await runSearchTask([updatedTask]);
        }
      } else {
        throw new Error("Failed to regenerate task details from AI.");
      }
    } catch (error) {
      handleError(error);
      updateTask(taskId, { state: "failed" });
    }
  }

  async function regenerateSummary(taskId: string) {
    const { tasks, updateTask } = useTaskStore.getState();
    const { references } = useSettingStore.getState();
    const { networkingModel } = getModel();

    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.type !== "search") {
      toast.error("Task not found or not a search task.");
      return;
    }

    if (!task.sources || task.sources.length === 0) {
      toast.error("No sources available to regenerate summary.");
      return;
    }

    updateTask(taskId, { state: "summarizing", learning: "" });
    setStatus(t("research.common.writing"));

    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    let content = "";
    let reasoning = "";
    const enableReferences = task.sources.length > 0 && references === "enable";

    try {
      const searchResult = streamText({
        model: await createModelProvider(networkingModel),
        system: getSystemPrompt(),
        prompt: [
          processSearchResultPrompt(
            task.query,
            task.researchGoal,
            task.sources,
            enableReferences
          ),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      for await (const part of searchResult.fullStream) {
        if (part.type === "text-delta") {
          thinkTagStreamProcessor.processChunk(
            part.textDelta,
            (data) => {
              content += data;
              updateTask(task.id, { learning: content });
            },
            () => {
              reasoning += part.textDelta;
            }
          );
        } else if (part.type === "reasoning") {
          reasoning += part.textDelta;
        }
      }
      if (reasoning) console.log(reasoning);

      if (task.sources.length > 0 && enableReferences) {
        content +=
          "\n\n" +
          task.sources
            .map(
              (item: Source, idx: number) =>
                `[${idx + 1}]: ${item.url}${item.title ? ` "${item.title.replaceAll('"', " ")}"` : ""
                }`
            )
            .join("\n");
      }

      updateTask(taskId, { state: "completed", learning: content });
    } catch (error) {
      handleError(error);
      updateTask(taskId, { state: "failed" });
    }
  }

  async function deepResearch() {
    const { reportPlan } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    try {
      const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
      const result = streamText({
        model: await createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          generateSerpQueriesPrompt(reportPlan),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      const querySchema = getSERPQuerySchema();
      let content = "";
      let reasoning = "";
      let queries: SearchTask[] = [];
      for await (const textPart of result.textStream) {
        thinkTagStreamProcessor.processChunk(
          textPart,
          (text) => {
            content += text;
            const data = parsePartialJson(
              removeJsonMarkdown(content)
            );
            if (querySchema.safeParse(data.value)) {
              if (
                data.state === "repaired-parse" ||
                data.state === "successful-parse"
              ) {
                if (data.value) {
                  queries = (data.value as { query: string; title: string; researchGoal: string }[]).map(
                    (item: {
                      query: string;
                      title: string;
                      researchGoal: string;
                    }) => {
                      const researchGoal = item.researchGoal || "";
                      // Priority 1: Use AI-generated title if available and not empty.
                      // Priority 2: Extract the first sentence of researchGoal as the title.
                      // Priority 3: Fallback to query if title is still empty.
                      const title =
                        item.title?.trim() ||
                        researchGoal.split(/[.!?。！？]/)[0].trim() ||
                        item.query;

                      return {
                        id: nanoid(),
                        type: "search" as const,
                        query: item.query,
                        researchGoal: researchGoal,
                        title: title,
                        state: "unprocessed",
                        learning: "",
                        sources: [],
                        images: [],
                        depth: 0,
                      };
                    }
                  );
                  taskStore.update(queries);
                }
              }
            }
          },
          (text) => {
            reasoning += text;
          }
        );
      }
      if (reasoning) console.log(reasoning);
      await runSearchTask(queries);
    } catch (err) {
      console.error(err);
    }
  }

  return {
    status,
    deepResearch,
    askQuestions,
    writeReportPlan,
    runSearchTask,
    runWiderResearch,
    runDeeperResearch,
    writeFinalReport,
    rerunTask,
    regenerateAndRerunTask,
    cancelTask,
    regenerateSummary,
    cancelDeeperResearch,
    checkAutoDeepResearch,
  };
}

export default useDeepResearch;
