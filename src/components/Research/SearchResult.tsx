"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useRef } from "react";
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
  Source,
} from "@/types";
import { debugThinkingBlockState } from "@/utils/debug-thinking-block";

const MagicDown = dynamic(() => import("@/components/MagicDown"));
const MagicDownView = dynamic(() => import("@/components/MagicDown/View"));
const ThinkingView = dynamic(() => import("@/components/MagicDown/ThinkingView"));
const ThreePhaseThinkingView = dynamic(() => import("@/components/MagicDown/ThreePhaseThinkingView"));
const Lightbox = dynamic(() => import("@/components/Internal/Lightbox"));
const SearchControlSidebar = dynamic(() => import("./SearchControlSidebar"));
const FloatingMenu = dynamic(() => import("@/components/Internal/FloatingMenu"));

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

function getThinkingStateText(thinkingTask: ThinkingTask, t: (key: string) => string): string {
  const reasoning = thinkingTask.reasoning || "";
  
  if (reasoning.includes("🔄")) {
    if (reasoning.includes(t("research.thinking.tasksGenerated")) || reasoning.includes(t("research.thinking.generatingTasks"))) {
      return t("research.thinking.generatingSearchTasks");
    }
    return t("research.thinking.generatingTasks");
  } else if (reasoning.includes("🧠")) {
    return t("research.thinking.deepThinking");
  } else if (thinkingTask.state === "processing") {
    return t("research.thinking.thinking");
  } else {
    return t("research.thinking.completed");
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
    tasksCount: tasks.length,
    searchTasks: tasks.filter(t => t.type === "search").length,
    completedSearchTasks: tasks.filter(t => t.type === "search" && (t as SearchTask).state === "completed").length
  });

  if (isThinking || researchStatus !== "idle") {
    console.log(
      `[DEBUG_BUTTON] Disabled because: isThinking=${isThinking} OR researchStatus='${researchStatus}' !== 'idle'`
    );
    return t("research.status.researchInProgress");
  }
  
  // 检查是否有任何搜索任务
  const searchTasks = tasks.filter(t => t.type === "search") as SearchTask[];
  if (searchTasks.length === 0) {
    console.log(`[DEBUG_BUTTON] Disabled because: no search tasks exist`);
    return t("research.status.noTasks");
  }
  
  if (!taskFinished) {
    console.log(`[DEBUG_BUTTON] Disabled because: taskFinished=${taskFinished}`);
    return t("research.status.tasksRunning");
  }
  
  const hasCompletedTasks = searchTasks.some(t => t.state === "completed");
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
    researchStatus,
    currentDepth,
  } = useTaskStore();

  const {
    runSearchTask,
    runWiderResearch,
    runDeeperResearch,
    regenerateAndRerunTask,
    rerunTask,
    cancelTask,
    regenerateSummary,
  } = useDeepResearch();
  const { generateId } = useKnowledge();
  const {
    start: accurateTimerStart,
    stop: accurateTimerStop,
  } = useAccurateTimer();
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [originalTasks, setOriginalTasks] = useState<Record<string, SearchTask>>({});
  const containerRef = useRef<HTMLDivElement>(null);


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
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    if (task.type === "thinking") {
      // 对于thinking task，确认后级联删除
      const taskDepth = (task as ThinkingTask).depth;
      const affectedTasks = tasks.filter(t => {
        if (t.type === "thinking") {
          return (t as ThinkingTask).depth >= taskDepth && t.id !== id;
        } else {
          return (t as SearchTask).depth >= taskDepth;
        }
      });
      
      console.log("【删除确认】thinking task深度:", taskDepth);
      console.log("【删除确认】受影响的任务:", affectedTasks.map(t => ({ id: t.id, type: t.type, title: t.title, depth: t.type === "thinking" ? (t as ThinkingTask).depth : (t as SearchTask).depth })));
      
      if (window.confirm(
        `删除此思考节点会影响 ${affectedTasks.length + 1} 个任务（包括本身）。\n\n确认删除吗？`
      )) {
        handleCascadeDelete(id, taskDepth);
      }
    } else {
      // 对于search task，直接删除
      cancelTask(id);
    }
  }
  
  function handleCascadeDelete(thinkingTaskId: string, fromDepth: number) {
    const { removeTask, setResearchStatus } = useTaskStore.getState();
    
    console.log("【级联删除】开始删除，起始深度:", fromDepth);
    
    // 1. 首先强制停止正在进行的研究
    if (researchStatus !== "idle") {
      console.log("【级联删除】强制停止正在进行的研究, 当前状态:", researchStatus);
      setResearchStatus("stopping");
    }
    
    // 2. 找到要删除的所有任务
    const tasksToRemove = tasks.filter(t => {
      if (t.type === "thinking") {
        // 删除同深度及更深的thinking tasks（不包括当前要删除的task，会单独处理）
        return (t as ThinkingTask).depth >= fromDepth && t.id !== thinkingTaskId;
      } else {
        // 删除比thinking task深度更深的search tasks
        return (t as SearchTask).depth >= fromDepth;
      }
    });
    
    console.log("【级联删除】要删除的任务数量:", tasksToRemove.length + 1);
    console.log("【级联删除】要删除的任务列表:", tasksToRemove.map(t => ({ id: t.id, type: t.type, title: t.title })));
    
    // 3. 立即执行删除操作
    console.log("【级联删除】开始删除thinking task:", thinkingTaskId);
    removeTask(thinkingTaskId);
    
    // 4. 删除相关的所有任务
    tasksToRemove.forEach(task => {
      console.log("【级联删除】删除任务:", { id: task.id, type: task.type, title: task.title });
      removeTask(task.id);
    });
    
    // 5. 强制设置为idle状态并重新计算
    setResearchStatus("idle");
    setTimeout(() => {
      recalculateResearchState();
    }, 50);
    
    toast.success(`${t("research.common.cascadeDelete")}: ${tasksToRemove.length + 1} ${t("research.common.tasks")}`);
  }
  
  
  function handleCompressToUpperLevel(thinkingTaskId: string, thinkingTask: ThinkingTask) {
    const { removeTask, updateTask } = useTaskStore.getState();
    const taskDepth = thinkingTask.depth;
    const targetDepth = taskDepth - 1;
    
    if (targetDepth < 0) {
      toast.error("无法压缩到更高层级");
      return;
    }
    
    // 找到需要压缩的任务
    const tasksToCompress = tasks.filter(t => 
      t.type === "search" && (t as SearchTask).depth > taskDepth
    ) as SearchTask[];
    
    const thinkingTasksToRemove = tasks.filter(t =>
      t.type === "thinking" && (t as ThinkingTask).depth >= taskDepth
    ) as ThinkingTask[];
    
    if (window.confirm(
      `将 ${tasksToCompress.length} 个搜索任务压缩到第 ${targetDepth} 层，` +
      `并删除 ${thinkingTasksToRemove.length} 个思考节点。\n\n确认执行此操作吗？`
    )) {
      // 1. 删除所有thinking tasks（包括当前的）
      thinkingTasksToRemove.forEach(task => removeTask(task.id));
      
      // 2. 将搜索任务的深度调整到目标深度
      tasksToCompress.forEach(task => {
        updateTask(task.id, { depth: targetDepth });
      });
      
      // 3. 重新计算状态
      recalculateResearchState();
      
      toast.success(`已压缩 ${tasksToCompress.length} 个任务到第 ${targetDepth} 层`);
    }
  }
  
  function recalculateResearchState() {
    const { setResearchStatus, setCurrentDepth, tasks: currentTasks } = useTaskStore.getState();
    
    // 重新获取当前任务列表
    const remainingTasks = currentTasks;
    
    if (remainingTasks.length === 0) {
      setResearchStatus("idle");
      setCurrentDepth(0);
      // 不要重置maxDepth！保持系统允许的最大深度设置
      return;
    }
    
    
    // 计算当前深度（最高已完成的深度）
    const searchTasks = remainingTasks.filter(t => t.type === "search") as SearchTask[];
    const completedDepths = searchTasks
      .filter(t => t.state === "completed")
      .map(t => t.depth);
    const currentDepth = completedDepths.length > 0 ? Math.max(...completedDepths) : 0;
    
    // 检查是否有正在进行的任务
    const hasActiveResearch = remainingTasks.some(t => 
      (t.type === "thinking" && (t as ThinkingTask).state === "processing") ||
      (t.type === "search" && ["processing", "searching", "summarizing", "waiting"].includes((t as SearchTask).state))
    );
    
    // 更新状态 - 注意：不要重置maxDepth系统限制！
    setResearchStatus(hasActiveResearch ? "deeper-research" : "idle");
    setCurrentDepth(currentDepth);
    // setMaxDepth(maxDepth); // 删除这行！不要重置系统的最大深度限制
    
    const maxTaskDepth = remainingTasks.length > 0 ? Math.max(
      ...remainingTasks.map(t => 
        t.type === "thinking" ? (t as ThinkingTask).depth : (t as SearchTask).depth
      ),
      0
    ) : 0;
    
    console.log("[RECALCULATE_STATE] Updated state:", {
      remainingTasksCount: remainingTasks.length,
      maxTaskDepth,
      currentDepth,
      researchStatus: hasActiveResearch ? "deeper-research" : "idle",
      hasActiveResearch
    });
  }

  useEffect(() => {
    form.setValue("suggestion", suggestion);
  }, [suggestion, form]);

  return (
    <div className="relative p-4 border rounded-md mt-4 print:hidden" ref={containerRef}>
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
                            ({getThinkingStateText(thinkingTask, t)})
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-blue-500/5">
                      {/* 检查是否有反思内容，如果有则使用三阶段视图 */}
                      {thinkingTask.reflection || thinkingTask.strategicThinking ? (
                        <ThreePhaseThinkingView
                          reflection={thinkingTask.reflection}
                          strategicThinking={thinkingTask.strategicThinking}
                          reasoning={thinkingTask.reasoning}
                          completionStatus={thinkingTask.completionStatus}
                          researchGaps={thinkingTask.researchGaps}
                        />
                      ) : (
                        <ThinkingView content={item.reasoning || ""} />
                      )}
                      <div className="flex items-center justify-end space-x-2 mt-4 pt-2 border-t">
                        <Button
                          onClick={() => handleCascadeDelete(item.id, (item as ThinkingTask).depth)}
                          variant="destructive"
                          size="sm"
                          title="删除此思考节点及其后续所有相关任务"
                        >
                          <Trash className="mr-1 h-4 w-4" />
                          {t("research.common.cascadeDelete")}
                        </Button>
                        {(() => {
                          const thinkingTask = item as ThinkingTask;
                          const searchTasksToMerge = tasks.filter(t => 
                            t.type === "search" && (t as SearchTask).depth > thinkingTask.depth
                          );
                          
                          if (searchTasksToMerge.length > 0 && thinkingTask.depth > 0) {
                            return (
                              <Button
                                onClick={() => handleCompressToUpperLevel(item.id, thinkingTask)}
                                variant="outline"
                                size="sm"
                                title={`保留搜索结果，将 ${searchTasksToMerge.length} 个搜索任务压缩到上一层`}
                              >
                                <RotateCcw className="mr-1 h-4 w-4" />
                                {t("research.common.compressToUpperLevel")}
                              </Button>
                            );
                          }
                          return null;
                        })()}
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
                          onClick={() => {
                            // 找到第一个已完成的搜索任务
                            const completedSearchTask = tasks.find(
                              t => t.type === "search" && (t as SearchTask).state === "completed"
                            );
                            if (completedSearchTask) {
                              handleDeeperResearch(completedSearchTask.id);
                            } else {
                              console.error("[DEBUG_UI] No completed search task found for deeper research");
                              toast.error("没有找到已完成的搜索任务");
                            }
                          }}
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
      
      {/* Search Control Sidebar */}
      <FloatingMenu 
        targetRef={containerRef}
        fixedTopOffset={16}
        fixedRightOffset={-70}
      >
        <SearchControlSidebar />
      </FloatingMenu>
    </div>
  );
}

export default SearchResult;
