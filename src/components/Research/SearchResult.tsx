"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  LoaderCircle,
  CircleCheck,
  TextSearch,
  Download,
  Trash,
  RotateCcw,
  NotebookText,
  Search,
  TrendingUp,
  Hourglass,
  XCircle,
  Play,
  Pencil,
  Save,
  BrainCircuit,
  FilePenLine,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/Internal/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import useAccurateTimer from "@/hooks/useAccurateTimer";
import useDeepResearch from "@/hooks/useDeepResearch";
import useKnowledge from "@/hooks/useKnowledge";
import { useTaskStore } from "@/store/task";
import { useKnowledgeStore } from "@/store/knowledge";
import { downloadFile } from "@/utils/file";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  SearchTask,
  ThinkingTask,
  Knowledge,
  Source,
  ResearchItem,
} from "@/types";
import { debugThinkingBlockState } from "@/utils/debug-thinking-block";

const MagicDown = dynamic(() => import("@/components/MagicDown"));
const MagicDownView = dynamic(() => import("@/components/MagicDown/View"));
const Lightbox = dynamic(() => import("@/components/Internal/Lightbox"));

const formSchema = z.object({
  suggestion: z.string().optional(),
});

function addQuoteBeforeAllLine(text: string = "") {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function TaskState({ state }: { state: SearchTask["state"] }) {
  if (state === "completed") {
    return <CircleCheck className="h-5 w-5 text-green-500" />;
  } else if (state === "processing") {
    return <LoaderCircle className="animate-spin h-5 w-5" />;
  } else if (state === "searching") {
    return <Search className="animate-pulse h-5 w-5 text-blue-500" />;
  } else if (state === "summarizing") {
    return <NotebookText className="animate-pulse h-5 w-5 text-blue-500" />;
  } else if (state === "waiting") {
    return <Hourglass className="h-5 w-5 text-yellow-500" />;
  } else if (state === "cancelled") {
    return <XCircle className="h-5 w-5 text-gray-500" />;
  } else if (state === "failed") {
    return <XCircle className="h-5 w-5 text-red-500" />;
  } else {
    return <TextSearch className="h-5 w-5" />;
  }
}

function getDeeperResearchDisabledReason(
  t: (key: string) => string,
  isThinking: boolean,
  taskFinished: boolean,
  researchStatus: string,
  tasks: (SearchTask | ThinkingTask)[]
): string {
  console.log("[DEBUG_BUTTON] Checking disabled status with:", {
    isThinking,
    taskFinished,
    researchStatus,
  });

  if (isThinking || researchStatus !== "idle") {
    console.log(
      `[DEBUG_BUTTON] Disabled because: isThinking=${isThinking} OR researchStatus='${researchStatus}' !== 'idle'`
    );
    return t("research.status.researchInProgress");
  }
  if (!taskFinished) {
    console.log(`[DEBUG_BUTTON] Disabled because: taskFinished=${taskFinished}`);
    return t("research.status.tasksRunning");
  }
  const hasCompletedTasks = tasks.some(
    (t) => t.type === "search" && t.state === "completed"
  );
  if (!hasCompletedTasks) {
    console.log(
      `[DEBUG_BUTTON] Disabled because: hasCompletedTasks=${hasCompletedTasks}`
    );
    return t("research.status.noCompletedTasks");
  }
  console.log("[DEBUG_BUTTON] No reason to disable. Button should be active.");
  return "";
}

function SearchResult() {
  const { t } = useTranslation();
  const {
    tasks,
    suggestion,
    updateTask,
    removeTask,
    setSuggestion,
    researchStatus,
    currentDepth,
  } = useTaskStore();

  const {
    status,
    runSearchTask,
    runWiderResearch,
    runDeeperResearch,
    regenerateAndRerunTask,
    rerunTask,
    cancelTask,
    regenerateSummary,
    cancelDeeperResearch,
  } = useDeepResearch();
  const { generateId } = useKnowledge();
  const {
    formattedTime,
    start: accurateTimerStart,
    stop: accurateTimerStop,
  } = useAccurateTimer();
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [originalTasks, setOriginalTasks] = useState<Record<string, SearchTask>>({});

  const isThinkingDeeper = useMemo(() => {
    return researchStatus === "deeper-research";
  }, [researchStatus]);

  // 诊断工具：在开发时添加调试信息
  const debugInfo = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      return debugThinkingBlockState(tasks, researchStatus, isThinking, currentDepth);
    }
    return null;
  }, [tasks, researchStatus, isThinking, currentDepth]);
  const unfinishedTasks = useMemo(() => {
    return tasks.filter(
      (item): item is SearchTask => item.type === "search" && item.state !== "completed"
    );
  }, [tasks]);
  const taskFinished = useMemo(() => {
    return tasks.length > 0 && unfinishedTasks.length === 0;
  }, [tasks, unfinishedTasks]);

  const deeperResearchDisabledReason = getDeeperResearchDisabledReason(
    t,
    isThinking,
    taskFinished,
    researchStatus,
    tasks
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      suggestion: suggestion,
    },
  });

  function getSearchResultContent(item: SearchTask) {
    return [
      `## ${item.query}`,
      addQuoteBeforeAllLine(item.researchGoal),
      "---",
      item.learning,
      item.images?.length > 0
        ? `#### ${t("research.searchResult.relatedImages")}\n\n${item.images
          .map(
            (source) =>
              `![${source.description || source.url}](${source.url})`
          )
          .join("\n")}`
        : "",
      item.sources?.length > 0
        ? `#### ${t("research.common.sources")}\n\n${item.sources
          .map(
            (source: Source, idx: number) =>
              `${idx + 1}. [${source.title || source.url}][${idx + 1}]`
          )
          .join("\n")}`
        : "",
    ].join("\n\n");
  }

  async function handleSubmit(values: z.infer<typeof formSchema>) {
    const { setSuggestion } = useTaskStore.getState();
    try {
      accurateTimerStart();
      setIsThinking(true);
      if (unfinishedTasks.length > 0) {
        await runSearchTask(unfinishedTasks);
      } else {
        if (values.suggestion) setSuggestion(values.suggestion);
      }
    } finally {
      setIsThinking(false);
      accurateTimerStop();
    }
  }

  async function handleWiderResearch() {
    const { setSuggestion } = useTaskStore.getState();
    const values = form.getValues();
    try {
      accurateTimerStart();
      setIsThinking(true);
      if (values.suggestion) setSuggestion(values.suggestion);
      await runWiderResearch();
      setSuggestion("");
    } finally {
      setIsThinking(false);
      accurateTimerStop();
    }
  }

  const handleDeeperResearch = async (taskId: string) => {
    console.log(`[DEBUG_UI] handleDeeperResearch called for taskId: ${taskId}`);
    const task = tasks.find((t) => t.id === taskId) as SearchTask;
    if (!task) {
      console.error(`[DEBUG_UI] Task with id ${taskId} not found in tasks array!`);
      return;
    }
    const reason = getDeeperResearchDisabledReason(
      t,
      isThinking,
      taskFinished,
      researchStatus,
      tasks
    );
    console.log(`[DEBUG_UI] Disabled reason for task ${taskId}:`, reason || "None");

    if (reason) {
      toast.warning(reason);
    } else {
      console.log(`[DEBUG_UI] Calling runDeeperResearch for task ${taskId}...`);
      runDeeperResearch(task.id);
    }
  };

  async function startTaskNow(item: SearchTask) {
    const { updateTask } = useTaskStore.getState();
    if (item.timerId) {
      clearTimeout(item.timerId);
    }
    const taskToRun = { ...item, state: 'unprocessed' as const };
    updateTask(item.id, { state: 'unprocessed', timerId: undefined });
    await runSearchTask([taskToRun]);
  }

  function addToKnowledgeBase(item: SearchTask) {
    const { save } = useKnowledgeStore.getState();
    const currentTime = Date.now();
    save({
      id: generateId("knowledge"),
      title: item.query,
      content: getSearchResultContent(item),
      type: "knowledge",
      createdAt: currentTime,
      updatedAt: currentTime,
    });
    toast.message(t("research.common.addToKnowledgeBaseTip"));
  }

  async function handleRetry(item: SearchTask) {
    const originalTask = originalTasks[item.id];
    const runIntelligently = originalTask && originalTask.title !== item.title;

    if (runIntelligently) {
      await regenerateAndRerunTask(item.id);
    } else {
      await rerunTask(item.id);
    }

    if (originalTask) {
      setOriginalTasks((prev) => {
        const newOriginals = { ...prev };
        delete newOriginals[item.id];
        return newOriginals;
      });
    }
  }

  function handleRemove(id: string) {
    cancelTask(id);
  }

  useEffect(() => {
    form.setValue("suggestion", suggestion);
  }, [suggestion, form]);

  return (
    <div className="p-4 border rounded-md mt-4 print:hidden">
      <div className="p-4 rounded-md">
        <h2 className="font-semibold text-lg leading-10">
          {t("research.searchResult.title")}
        </h2>

        <div>
          <Accordion className="mb-4" type="multiple">
            {tasks.map((item) => {
              const isEditing = editingTaskId === item.id;

              if (item.type === "thinking") {
                const thinkingTask = item as ThinkingTask;
                return (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-blue-500/50"
                  >
                    <AccordionTrigger>
                      <div className="flex items-center space-x-2 text-blue-500">
                        {thinkingTask.state === "processing" ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span>{item.title}</span>
                        {thinkingTask.state === "processing" && (
                          <span className="ml-2 text-muted-foreground text-sm">
                            ({t("research.status.processing", "思考中...")})
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-blue-500/5">
                      <MagicDownView>{item.reasoning || ""}</MagicDownView>
                      <div className="flex items-center justify-end space-x-2 mt-4 pt-2 border-t">
                        <Button
                          onClick={() => handleRemove(item.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash className="mr-1 h-4 w-4" />
                          {t("research.common.delete")}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              }

              return (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <TaskState state={(item as SearchTask).state} />
                      <span className="ml-1">{item.title}</span>
                      {[
                        "searching",
                        "summarizing",
                        "waiting",
                        "processing",
                      ].includes((item as SearchTask).state) && (
                          <span className="ml-2 text-muted-foreground text-sm">
                            ({t(`research.status.${(item as SearchTask).state}`, '...')})
                          </span>
                        )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="prose prose-slate dark:prose-invert max-w-full min-h-20">
                    {isEditing ? (
                      <div className="space-y-2 my-4">
                        <Input
                          value={item.title}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateTask(item.id, { title: e.target.value })
                          }
                          className="text-lg font-semibold"
                        />
                        <Textarea
                          value={(item as SearchTask).researchGoal}
                          onChange={(
                            e: React.ChangeEvent<HTMLTextAreaElement>
                          ) =>
                            updateTask(item.id, {
                              researchGoal: e.target.value,
                            })
                          }
                          className="text-sm text-muted-foreground h-24"
                          placeholder={t(
                            "research.topic.researchGoalPlaceholder"
                          )}
                        />
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const goal = (item as SearchTask).researchGoal;
                          return (
                            <MagicDownView>
                              {addQuoteBeforeAllLine(goal || "")}
                            </MagicDownView>
                          );
                        })()}
                        <Separator className="mb-4" />
                      </>
                    )}

                    {(() => {
                      const learning = (item as SearchTask).learning;
                      return (
                        <MagicDown
                          value={learning || ""}
                          onChange={(value) =>
                            updateTask(item.id, { learning: value })
                          }
                          tools={<></>}
                        />
                      );
                    })()}
                    <div className="flex items-center justify-end space-x-2 mt-4 pt-2 border-t">
                      {isEditing ? (
                        <Button
                          onClick={() => setEditingTaskId(null)}
                          variant="default"
                          size="sm"
                        >
                          <Save className="mr-1 h-4 w-4" />
                          {t("research.common.save")}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setEditingTaskId(item.id);
                            setOriginalTasks((prev) => ({ ...prev, [item.id]: item as SearchTask }));
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          {t("research.common.edit")}
                        </Button>
                      )}

                      {(item as SearchTask).state === "waiting" && (
                        <Button
                          onClick={() => startTaskNow(item as SearchTask)}
                          variant="outline"
                          size="sm"
                        >
                          <Play className="mr-1 h-4 w-4" />
                          {t("research.common.startNow")}
                        </Button>
                      )}

                      <Button
                        onClick={() => handleRetry(item as SearchTask)}
                        variant="outline"
                        size="sm"
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        {t("research.common.restudy")}
                      </Button>
                      <Button
                        onClick={() => regenerateSummary(item.id)}
                        variant="outline"
                        size="sm"
                        disabled={
                          (item as SearchTask).state !== "completed" ||
                          !(item as SearchTask).sources ||
                          (item as SearchTask).sources!.length === 0
                        }
                      >
                        <FilePenLine className="mr-1 h-4 w-4" />
                        {t("research.common.regenerateSummary")}
                      </Button>
                      <Button
                        onClick={() => handleRemove(item.id)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash className="mr-1 h-4 w-4" />
                        {t("research.common.delete")}
                      </Button>

                      <Separator orientation="vertical" className="h-6" />

                      <Button
                        onClick={() => addToKnowledgeBase(item as SearchTask)}
                        variant="outline"
                        size="sm"
                      >
                        <NotebookText className="mr-1 h-4 w-4" />
                        {t("research.common.addToKnowledgeBase")}
                      </Button>
                      <Button
                        onClick={() =>
                          downloadFile(
                            getSearchResultContent(item as SearchTask),
                            `${(item as SearchTask).query}.md`,
                            "text/markdown;charset=utf-8"
                          )
                        }
                        variant="outline"
                        size="sm"
                      >
                        <Download className="mr-1 h-4 w-4" />
                        {t("research.common.export")}
                      </Button>
                    </div>

                    {(item as SearchTask).images?.length > 0 ? (
                      <>
                        <hr className="my-6" />
                        <h4>{t("research.searchResult.relatedImages")}</h4>
                        <Lightbox
                          data={(item as SearchTask).images!}
                        ></Lightbox>
                      </>
                    ) : null}
                    {(item as SearchTask).sources?.length > 0 ? (
                      <>
                        <hr className="my-6" />
                        <h4>{t("research.common.sources")}</h4>
                        <ol>
                          {(item as SearchTask).sources!.map(
                            (source: Source, idx: number) => {
                              return (
                                <li className="ml-2" key={idx}>
                                  <a href={source.url} target="_blank">
                                    {source.title || source.url}
                                  </a>
                                </li>
                              );
                            }
                          )}
                        </ol>
                      </>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          {isThinkingDeeper && (
            <div className="p-4 mt-4 mb-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-gray-800 rounded-md">
              <h4 className="font-semibold text-lg mb-2 flex items-center">
                <LoaderCircle className="animate-spin mr-2" />
                Deeper Research in Progress...
              </h4>
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <FormField
                control={form.control}
                name="suggestion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 font-semibold">
                      {t("research.searchResult.suggestionLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder={t(
                          "research.searchResult.suggestionPlaceholder"
                        )}
                        disabled={isThinking}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex gap-4 mt-4">
                <Button
                  className="w-full"
                  type="button"
                  variant="outline"
                  disabled={isThinking || !taskFinished || researchStatus !== "idle"}
                  onClick={handleWiderResearch}
                >
                  <TrendingUp className="mr-2" />
                  {t("research.common.widerResearch")}
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <Button
                          className="w-full"
                          type="button"
                          variant="default"
                          disabled={!!deeperResearchDisabledReason}
                          onClick={() => handleDeeperResearch(tasks[0].id)}
                        >
                          <BrainCircuit className="mr-2" />
                          {t("research.common.deeperResearch")}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {deeperResearchDisabledReason && (
                      <TooltipContent>
                        <p>{deeperResearchDisabledReason}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default SearchResult;
