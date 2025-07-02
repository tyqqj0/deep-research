import { nanoid } from "nanoid";
import { streamText } from "ai";
import { toast } from "sonner";
import { i18n } from "@/utils/i18n";
import { useTaskStore } from "@/store/task";
import { useSettingStore } from "@/store/setting";
import { createModelProvider } from "@/utils/deep-research/provider";
import { getModel } from "@/utils/model";
import {
  getSystemPrompt,
  reflectCurrentResearchPrompt,
  getResponseLanguagePrompt,
  planNextDeepStepPrompt,
  generateTasksFromPlanPrompt,
  extractReflectionResults,
  extractResearchTasks,
  extractStrategicThinking,
  getSERPQuerySchema,
} from "@/utils/deep-research/prompts";
import { removeJsonMarkdown } from "@/utils/markdown";
import { parsePartialJson } from "@/utils/parser";
import { handleError } from "@/utils/error";
import { SearchTask, ThinkingTask } from "@/types";

export interface DeeperStrategyDependencies {
  runSearchTask: (tasks: SearchTask[]) => Promise<void>;
}

export class DeeperStrategy {
  constructor(private dependencies: DeeperStrategyDependencies) {}

  async execute(taskId: string): Promise<void> {
    console.log(`[DeeperStrategy] execute called for taskId: ${taskId}`);

    const {
      researchStatus,
      tasks,
      addTasks,
      updateTask,
      removeTask,
      setResearchStatus,
      setCurrentDepth,
      clearAllRetryStates,
      setStatus,
    } = useTaskStore.getState();

    clearAllRetryStates();

    const { maxResearchDepth } = useSettingStore.getState();
    const maxDepth = maxResearchDepth;
    const { thinkingModel } = getModel();

    if (researchStatus === "deeper-research") {
      console.log(
        `[DeeperStrategy] Aborting: researchStatus is already 'deeper-research'.`
      );
      return;
    }

    const lastTask = tasks.find((t) => t.id === taskId) as SearchTask;
    if (!lastTask) {
      console.error(
        `[DeeperStrategy] Aborting: lastTask with id ${taskId} not found.`
      );
      return;
    }

    setResearchStatus("deeper-research");

    try {
      let currentMaxDepth = lastTask.depth;

      while (
        currentMaxDepth < maxDepth &&
        useTaskStore.getState().researchStatus === "deeper-research"
      ) {
        setStatus(i18n.t("research.common.deeperResearch"));
        setCurrentDepth(currentMaxDepth);

        const existingThinking = tasks.find(
          (t) => t.type === "thinking" && t.depth === currentMaxDepth + 1
        );

        if (existingThinking) {
          if (existingThinking.state === "completed") {
            const correspondingSearchTasks = tasks.filter(
              (t): t is SearchTask =>
                t.type === "search" && t.depth === currentMaxDepth + 1
            );

            if (correspondingSearchTasks.length > 0) {
              currentMaxDepth++;
              continue;
            } else {
              removeTask(existingThinking.id);
            }
          } else {
            break;
          }
        }

        const learningsAtCurrentDepth = tasks
          .filter(
            (t): t is SearchTask =>
              t.type === "search" &&
              (t.depth || 0) === currentMaxDepth &&
              t.state === "completed"
          )
          .map((t) => t.learning);

        if (learningsAtCurrentDepth.length === 0) {
          break;
        }

        const thinkingTaskId = nanoid();
        const thinkingTask: ThinkingTask = {
          id: thinkingTaskId,
          type: "thinking",
          depth: currentMaxDepth + 1,
          title: `${i18n.t("research.thinking.title")} ${currentMaxDepth + 1}`,
          reasoning: "",
          state: "processing",
        };

        addTasks([thinkingTask]);

        // Stage 1: Reflection
        const reflectionContent = await this.reflectCurrentResearch(
          thinkingTaskId,
          learningsAtCurrentDepth,
          currentMaxDepth
        );
        const reflectionResults = extractReflectionResults(reflectionContent);
        updateTask(thinkingTaskId, {
          completionStatus: reflectionResults.completionStatus || undefined,
          researchGaps: reflectionResults.researchGaps,
        });

        if (reflectionResults.completionStatus === "RESEARCH_COMPLETE") {
          updateTask(thinkingTaskId, {
            reasoning: "🎯 " + i18n.t("research.thinking.researchComplete"),
            state: "completed",
          });
          break;
        }

        // Stage 2: Strategic Thinking
        const strategicThinkingContent = await this.planNextStep(
          thinkingTaskId,
          learningsAtCurrentDepth,
          reflectionContent
        );
        const researchTasksContent = extractResearchTasks(
          strategicThinkingContent
        );
        const strategicThinkingExtracted = extractStrategicThinking(
          strategicThinkingContent
        );

        if (!researchTasksContent) {
          updateTask(thinkingTaskId, {
            reasoning: "❌ " + i18n.t("research.error.taskGenerationFailed"),
            state: "completed",
          });
          toast.error(i18n.t("research.error.aiFailedToGeneratePlan"));
          break;
        }

        // Stage 3: Task Generation
        const generatedTasks = await this.generateTasks(
          thinkingTaskId,
          strategicThinkingContent,
          currentMaxDepth + 1
        );

        if (generatedTasks.length === 0) {
          updateTask(thinkingTaskId, {
            reasoning:
              strategicThinkingContent +
              "\n\n❌ " +
              i18n.t("research.error.taskGenerationFailed"),
            state: "completed",
          });
          toast.error(i18n.t("research.error.aiFailedToGeneratePlan"));
          break;
        }

        const tasksListText = generatedTasks
          .map(
            (task, idx) =>
              `${idx + 1}. **${task.title}**\n   - ${i18n.t(
                "research.common.query"
              )}: ${task.query}\n   - ${i18n.t("research.common.goal")}: ${
                task.researchGoal
              }`
          )
          .join("\n");

        const finalReasoning =
          "✅ **" +
          i18n.t("research.thinking.generatedSearchTasks") +
          ":**\n" +
          tasksListText;

        updateTask(thinkingTaskId, {
          reasoning: finalReasoning,
          strategicThinking: strategicThinkingExtracted,
          state: "completed",
        });

        const addedTasks = useTaskStore
          .getState()
          .tasks.filter(
            (t): t is SearchTask =>
              t.type === "search" &&
              t.depth === currentMaxDepth + 1 &&
              t.state === "unprocessed"
          );

        if (addedTasks.length > 0) {
          await this.dependencies.runSearchTask(addedTasks);
        }

        await this.waitForDepthCompletion(currentMaxDepth + 1);

        const { researchStatus: currentStatus } = useTaskStore.getState();
        if (currentStatus === "stopping") {
          break;
        }

        currentMaxDepth++;
      }

      setStatus(i18n.t("research.common.researchCompleted"));
    } catch (error) {
      console.error("Deep research error:", error);
      handleError(error);
    } finally {
      setResearchStatus("idle");
    }
  }

  private async reflectCurrentResearch(
    thinkingTaskId: string,
    learnings: (string | undefined)[],
    currentMaxDepth: number
  ): Promise<string> {
    const { updateTask, question } = useTaskStore.getState();
    const { thinkingModel } = getModel();

    const reflectionResult = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [
        reflectCurrentResearchPrompt(question, learnings, currentMaxDepth),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      onError: handleError,
    });

    let reflectionContent = "";
    for await (const textPart of reflectionResult.textStream) {
      reflectionContent += textPart;
      updateTask(thinkingTaskId, {
        reflection: reflectionContent,
        state: "processing" as const,
      });
    }
    return reflectionContent;
  }

  private async planNextStep(
    thinkingTaskId: string,
    learnings: (string | undefined)[],
    reflectionContent: string
  ): Promise<string> {
    const { updateTask, question } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    const { deepSearchMaxTasks } = useSettingStore.getState();

    const strategicThinkingResult = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [
        planNextDeepStepPrompt(
          question,
          learnings,
          reflectionContent,
          deepSearchMaxTasks
        ),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      onError: handleError,
    });

    let strategicThinkingContent = "";
    for await (const textPart of strategicThinkingResult.textStream) {
      strategicThinkingContent += textPart;
      updateTask(thinkingTaskId, {
        strategicThinking: strategicThinkingContent,
        state: "processing" as const,
      });
    }
    return strategicThinkingContent;
  }

  private async generateTasks(
    thinkingTaskId: string,
    strategicThinkingContent: string,
    depth: number
  ): Promise<SearchTask[]> {
    const { updateTask, question, tasks } = useTaskStore.getState();
    const { thinkingModel } = getModel();

    updateTask(thinkingTaskId, {
      reasoning: "🔄 " + i18n.t("research.thinking.generatingSearchTasks") + "...",
      state: "processing" as const,
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
    let generatedTasks: SearchTask[] = [];
    let currentTaskCount = 0;

    for await (const textPart of taskGenerationResult.textStream) {
      taskContent += textPart;

      const cleanedContent = removeJsonMarkdown(taskContent);
      const data = parsePartialJson(cleanedContent);
      const taskSchema = getSERPQuerySchema();
      const parseResult = taskSchema.safeParse(data.value);

      if (parseResult.success && Array.isArray(data.value)) {
        if (
          data.state === "repaired-parse" ||
          data.state === "successful-parse"
        ) {
          const newTasks = data.value as {
            query: string;
            title: string;
            researchGoal: string;
          }[];

          const validTasks = newTasks.filter(
            (task) =>
              task.query &&
              task.title &&
              task.researchGoal &&
              task.query.length > 5 &&
              task.researchGoal.length > 10
          );

          if (validTasks.length > 0) {
            generatedTasks = validTasks.map((task) => {
              const researchGoal = task.researchGoal || "";
              const title =
                task.title?.trim() ||
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
                depth: depth,
              };
            });

            const otherTasks = tasks.filter(
              (t) => !(t.type === "search" && (t as SearchTask).depth === depth)
            );

            useTaskStore.getState().update([...otherTasks, ...generatedTasks]);
            currentTaskCount = generatedTasks.length;
          }
        }
      }

      let progressInfo = i18n.t("research.thinking.generatingTasks");
      if (currentTaskCount > 0) {
        progressInfo = i18n.t("research.thinking.tasksGenerated", {
          count: currentTaskCount,
        });
      } else if (taskContent.length > 100) {
        progressInfo =
          i18n.t("research.thinking.generatingTasks") +
          ` (${taskContent.length} chars)`;
      }

      updateTask(thinkingTaskId, {
        reasoning:
          strategicThinkingContent + "\n\n🔄 " + progressInfo + "...",
        state: "processing" as const,
      });
    }

    if (generatedTasks.length === 0 && taskContent.trim()) {
      const cleanedContent = removeJsonMarkdown(taskContent);
      const data = parsePartialJson(cleanedContent);
      const taskSchema = getSERPQuerySchema();
      const parseResult = taskSchema.safeParse(data.value);

      if (parseResult.success && Array.isArray(data.value)) {
        const finalTasks = data.value as {
          query: string;
          title: string;
          researchGoal: string;
        }[];
        const validFinalTasks = finalTasks.filter(
          (task) =>
            task.query &&
            task.title &&
            task.researchGoal &&
            task.query.length > 5 &&
            task.researchGoal.length > 10
        );

        if (validFinalTasks.length > 0) {
          const finalSearchTasks = validFinalTasks.map((task) => ({
            id: nanoid(),
            type: "search" as const,
            query: task.query,
            researchGoal: task.researchGoal,
            title: task.title,
            state: "unprocessed" as const,
            learning: "",
            sources: [],
            images: [],
            depth: depth,
          }));

          const otherTasks = useTaskStore
            .getState()
            .tasks.filter(
              (t) => !(t.type === "search" && (t as SearchTask).depth === depth)
            );
          useTaskStore.getState().update([...otherTasks, ...finalSearchTasks]);
          generatedTasks = finalSearchTasks;
        }
      }
    }

    return generatedTasks;
  }

  private async waitForDepthCompletion(depth: number): Promise<void> {
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
}
