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
  getDeepStepSchema,
} from "@/utils/deep-research/prompts";
import { isNetworkingModel } from "@/utils/model";
import { ThinkTagStreamProcessor, removeJsonMarkdown } from "@/utils/text";
import { parseError } from "@/utils/error";
import { pick, flat, unique } from "radash";
import { nanoid } from "nanoid";
import { z } from "zod";

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
        updateTask(item.id, { state: "processing" });
        if (resources.length > 0) {
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
    const { reportPlan, tasks, suggestion } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.research"));
    const learnings = tasks.map((item) => item.learning);
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
      const newTasks = queries.map(q => ({ ...q, id: nanoid() }))
      taskStore.update([...tasks, ...newTasks]);
      await runSearchTask(newTasks);
    }
  }

  async function runDeeperResearch() {
    const { tasks, maxDepth, updateThinkingProcess } = useTaskStore.getState();
    let currentDepth = tasks.length > 0 ? Math.max(...tasks.map((t) => t.depth)) : 0;
    const { thinkingModel } = getModel();

    while (currentDepth < maxDepth) {
      setStatus(t("research.common.deeperResearch"));
      const learningsAtCurrentDepth = tasks
        .filter((t) => t.depth === currentDepth)
        .map((t) => t.learning);

      updateThinkingProcess(
        `Synthesizing findings at depth ${currentDepth}...`
      );

      const result = streamText({
        model: await createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: [
          planNextDeepStepPrompt(learningsAtCurrentDepth),
          getResponseLanguagePrompt(),
        ].join("\n\n"),
        onError: handleError,
      });

      const deepStepSchema = getDeepStepSchema();
      let content = "";
      let reasoning = "";
      let deepStepResult: { query: string; reasoning: string } | undefined;

      for await (const textPart of result.textStream) {
        content += textPart;
        const data: PartialJson = parsePartialJson(removeJsonMarkdown(content));
        if (
          deepStepSchema.safeParse(data.value) &&
          (data.state === "repaired-parse" || data.state === "successful-parse")
        ) {
          deepStepResult = data.value;
          if (deepStepResult) {
            updateThinkingProcess(deepStepResult.reasoning);
          }
        }
      }

      if (!deepStepResult) {
        toast.error("AI failed to determine the next step for deeper research.");
        break; // Exit loop if AI fails
      }

      const finalDeepStepResult = deepStepResult; // Create a new, non-undefined variable

      const newDeepTask: SearchTask = {
        id: nanoid(),
        query: finalDeepStepResult.query,
        title: `Deep Dive: ${finalDeepStepResult.query}`,
        researchGoal: finalDeepStepResult.reasoning,
        state: "unprocessed",
        depth: currentDepth + 1,
        learning: "",
        sources: [],
        images: [],
      };

      // Add the new task and run it
      const currentTasks = useTaskStore.getState().tasks;
      taskStore.update([...currentTasks, newDeepTask]);
      await runSearchTask([newDeepTask]);

      // Move to the next depth level
      currentDepth++;
    }

    updateThinkingProcess(""); // Clear thinking process
    setStatus(t("research.common.researchCompleted"));
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
    const learnings = tasks.map((item) => item.learning);
    const sources: Source[] = unique(
      flat(tasks.map((item) => item.sources || [])),
      (item) => item.url
    );
    const images: ImageSource[] = unique(
      flat(tasks.map((item) => item.images || [])),
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
    const task = tasks.find(t => t.id === taskId);

    if (task?.timerId) {
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
    const task = tasks.find(t => t.id === taskId);
    if (task) {
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
    if (taskToRegenerate.timerId) {
      clearTimeout(taskToRegenerate.timerId);
    }

    updateTask(taskId, { state: "processing", learning: "" }); // Show immediate feedback
    setStatus(t("research.common.thinking"));

    const otherTasksLearnings = tasks
      .filter((t) => t.id !== taskId && t.state === "completed")
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
        if (updatedTask) {
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
                  taskStore.update(queries.map(q => ({ ...q, id: nanoid() })));
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
    cancelTask
  };
}

export default useDeepResearch;
