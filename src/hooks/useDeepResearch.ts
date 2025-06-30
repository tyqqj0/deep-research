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
  getDeepStepSchema,
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
  PartialJson,
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
          if (enableTaskWaitingTime) {
            updateTask(item.id, { state: "waiting" });
            const timerId = setTimeout(() => {
              startExecution(item);
            }, taskWaitingTime * 1000);
            updateTask(item.id, { timerId });
          } else {
            startExecution(item);
          }
        });
      })
    );

    async function startExecution(item: SearchTask) {
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
          if (searchProvider !== "model") {
            try {
              updateTask(item.id, { state: "searching" });
              const results = await search(item.query);
              sources = results.sources;
              images = results.images;

              if (sources.length === 0) {
                throw new Error("Invalid Search Results");
              }
            } catch (err) {
              console.error(err);
              handleError(
                `[${searchProvider}]: ${err instanceof Error ? err.message : "Search Failed"
                }`
              );
              return plimit.clearQueue();
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
            const data: PartialJson = parsePartialJson(
              removeJsonMarkdown(content)
            );
            if (
              querySchema.safeParse(data.value) &&
              data.state === "successful-parse"
            ) {
              if (data.value) {
                queries = data.value.map(
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
      setResearchStatus,
      maxDepth,
      setCurrentDepth,
    } = useTaskStore.getState();
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
          console.warn(
            "Thinking task already exists for depth",
            currentMaxDepth + 1
          );
          break;
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
        if (learningsAtCurrentDepth.length > 0) {
          console.log("  - 找到的学习成果:", learningsAtCurrentDepth);
        }

        if (learningsAtCurrentDepth.length === 0) {
          console.warn(
            "【退出循环】在当前深度未找到任何已完成的学习成果。"
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
          title: t("research.thinking.depthTitle", {
            depth: currentMaxDepth + 1,
          }),
          reasoning: "",
          state: "processing",
        };
        
        // 立即添加thinking task让用户看到
        addTasks([thinkingTask]);

        // 步骤 8：两阶段AI生成过程

        // 8.1 第一阶段：规划思考（流式更新reasoning）
        console.log("【检查点 6-1】开始第一阶段：规划思考...");
        const { question } = useTaskStore.getState(); // 获取原始研究主题
        const deepSearchMaxTasks = 3; // 默认生成3个任务，后续可在设置中配置
        
        const planningResult = streamText({
          model: await createModelProvider(thinkingModel),
          system: getSystemPrompt(),
          prompt: [
            planNextDeepStepPrompt(question, learningsAtCurrentDepth, deepSearchMaxTasks),
            getResponseLanguagePrompt(),
          ].join("\n\n"),
          onError: handleError,
        });

        let planningContent = "";
        for await (const textPart of planningResult.textStream) {
          planningContent += textPart;
          
          // 实时更新thinking task的reasoning
          updateTask(thinkingTaskId, { reasoning: planningContent });
        }

        // 8.2 提取研究任务规划内容
        const researchTasksContent = extractResearchTasks(planningContent);
        console.log("【检查点 6-2】提取到的研究任务规划:", researchTasksContent);

        if (!researchTasksContent) {
          updateTask(thinkingTaskId, { 
            reasoning: planningContent + "\n\n❌ 未能找到<RESEARCH_TASKS>标签，任务生成失败",
            state: "completed" 
          });
          toast.error(t("research.error.aiFailedToGeneratePlan"));
          break;
        }

        // 8.3 第二阶段：生成严格格式的任务
        console.log("【检查点 6-3】开始第二阶段：生成严格格式任务...");
        updateTask(thinkingTaskId, { 
          reasoning: planningContent + "\n\n🔄 正在生成具体搜索任务..." 
        });

        const taskGenerationResult = streamText({
          model: await createModelProvider(thinkingModel),
          system: getSystemPrompt(),
          prompt: [
            generateTasksFromPlanPrompt(planningContent, question),
            getResponseLanguagePrompt(),
          ].join("\n\n"),
          onError: handleError,
        });

        let taskContent = "";
        let deepStepResult:
          | { query: string; title: string; researchGoal: string }[]
          | undefined;
        
        for await (const textPart of taskGenerationResult.textStream) {
          taskContent += textPart;
          
          // 尝试解析JSON任务列表
          const data: PartialJson = parsePartialJson(removeJsonMarkdown(taskContent));
          const taskSchema = getSERPQuerySchema();
          if (
            taskSchema.safeParse(data.value) &&
            (data.state === "repaired-parse" || data.state === "successful-parse")
          ) {
            deepStepResult = data.value;
          }
        }

        if (!deepStepResult) {
          // AI生成失败，标记thinking task为失败状态  
          updateTask(thinkingTaskId, { 
            reasoning: planningContent + "\n\n❌ 任务生成失败，请重试",
            state: "completed" 
          });
          toast.error(t("research.error.aiFailedToGeneratePlan"));
          break;
        }

        // 步骤 9：标记thinking task完成并创建 search tasks
        const finalReasoning = planningContent + 
          "\n\n✅ **生成的搜索任务:**\n" +
          deepStepResult.map((task, idx) => 
            `${idx + 1}. **${task.title}**\n   - 查询: ${task.query}\n   - 目标: ${task.researchGoal}`
          ).join("\n");
          
        updateTask(thinkingTaskId, { 
          reasoning: finalReasoning,
          state: "completed" 
        });
        const newSearchTasks: SearchTask[] = deepStepResult.map(
          (q) => ({
            ...q,
            id: nanoid(),
            type: "search" as const,
            depth: currentMaxDepth + 1,
            state: "unprocessed" as const,
            learning: "",
            sources: [],
            images: [],
          })
        );

        // 步骤 10：添加search tasks到 store（thinking task已经添加过了）
        addTasks(newSearchTasks);

        // 步骤 11：执行搜索任务
        await runSearchTask(newSearchTasks);

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
    const learnings = tasks
      .filter((item): item is SearchTask => item.type === "search")
      .map((item) => item.learning);
    const sources: Source[] = unique(
      flat(
        tasks
          .filter((item): item is SearchTask => item.type === "search")
          .map((item) => item.sources || [])
      ),
      (item) => item.url
    );
    const images: ImageSource[] = unique(
      flat(
        tasks
          .filter((item): item is SearchTask => item.type === "search")
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
    const { updateTask, tasks, removeTask } = useTaskStore.getState();
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
    setTimeout(() => removeTask(taskId), 300);
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
        const data: PartialJson = parsePartialJson(
          removeJsonMarkdown(content)
        );
        if (
          RegeneratedTaskSchema.safeParse(data.value) &&
          (data.state === "repaired-parse" ||
            data.state === "successful-parse")
        ) {
          regeneratedData = data.value;
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
            (data) => {
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
            const data: PartialJson = parsePartialJson(
              removeJsonMarkdown(content)
            );
            if (querySchema.safeParse(data.value)) {
              if (
                data.state === "repaired-parse" ||
                data.state === "successful-parse"
              ) {
                if (data.value) {
                  queries = data.value.map(
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
  };
}

export default useDeepResearch;
