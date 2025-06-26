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
    return <CircleCheck className="h-5 w-5" />;
  } else if (state === "processing") {
    return <LoaderCircle className="animate-spin h-5 w-5" />;
  } else if (state === "waiting") {
    return <Hourglass className="h-5 w-5" />;
  } else if (state === "cancelled") {
    return <XCircle className="h-5 w-5" />;
  } else {
    return <TextSearch className="h-5 w-5" />;
  }
}

function SearchResult() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const {
    status,
    runSearchTask,
    runWiderResearch,
    runDeeperResearch,
    rerunTask,
    cancelTask,
  } = useDeepResearch();
  const { generateId } = useKnowledge();
  const {
    formattedTime,
    start: accurateTimerStart,
    stop: accurateTimerStop,
  } = useAccurateTimer();
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const isThinkingDeeper = useMemo(() => {
    return isThinking && taskStore.thinkingProcess !== "";
  }, [isThinking, taskStore.thinkingProcess]);
  const unfinishedTasks = useMemo(() => {
    return taskStore.tasks.filter((item) => item.state !== "completed");
  }, [taskStore.tasks]);
  const taskFinished = useMemo(() => {
    return taskStore.tasks.length > 0 && unfinishedTasks.length === 0;
  }, [taskStore.tasks, unfinishedTasks]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      suggestion: taskStore.suggestion,
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
            (source, idx) =>
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
        console.log("Form submitted for continuing unfinished tasks or suggestion.");
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

  async function handleDeeperResearch() {
    try {
      accurateTimerStart();
      setIsThinking(true);
      await runDeeperResearch();
    } finally {
      setIsThinking(false);
      accurateTimerStop();
    }
  }

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
    await rerunTask(item.id);
  }

  function handleRemove(id: string) {
    cancelTask(id);
  }

  useEffect(() => {
    form.setValue("suggestion", taskStore.suggestion);
  }, [taskStore.suggestion, form]);

  return (
    <section className="p-4 border rounded-md mt-4 print:hidden">
      <h3 className="font-semibold text-lg border-b mb-2 leading-10">
        {t("research.searchResult.title")}
      </h3>
      {taskStore.tasks.length === 0 ? (
        <div>{t("research.searchResult.emptyTip")}</div>
      ) : (
        <div>
          <Accordion className="mb-4" type="multiple">
            {taskStore.tasks.map((item) => {
              const isEditing = editingTaskId === item.id;
              return (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger>
                    <div className="flex">
                      <TaskState state={item.state} />
                      <span className="ml-1">{item.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="prose prose-slate dark:prose-invert max-w-full min-h-20">
                    {isEditing ? (
                      <div className="space-y-2 my-4">
                        <Input
                          value={item.title}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            taskStore.updateTask(item.id, { title: e.target.value })
                          }
                          className="text-lg font-semibold"
                        />
                        <Textarea
                          value={item.researchGoal}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            taskStore.updateTask(item.id, { researchGoal: e.target.value })
                          }
                          rows={3}
                        />
                      </div>
                    ) : (
                      <>
                        <MagicDownView>
                          {addQuoteBeforeAllLine(item.researchGoal)}
                        </MagicDownView>
                        <Separator className="mb-4" />
                      </>
                    )}

                    <MagicDown
                      value={item.learning}
                      onChange={(value) =>
                        taskStore.updateTask(item.id, { learning: value })
                      }
                      tools={<></>}
                    />
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
                          onClick={() => setEditingTaskId(item.id)}
                          variant="outline"
                          size="sm"
                        >
                          <Pencil className="mr-1 h-4 w-4" />
                          {t("research.common.edit")}
                        </Button>
                      )}

                      {item.state === "waiting" && (
                        <Button
                          onClick={() => startTaskNow(item)}
                          variant="outline"
                          size="sm"
                        >
                          <Play className="mr-1 h-4 w-4" />
                          {t("research.common.startNow")}
                        </Button>
                      )}

                      <Button
                        onClick={() => handleRetry(item)}
                        variant="outline"
                        size="sm"
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        {t("research.common.restudy")}
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
                        onClick={() => addToKnowledgeBase(item)}
                        variant="outline"
                        size="sm"
                      >
                        <NotebookText className="mr-1 h-4 w-4" />
                        {t("research.common.addToKnowledgeBase")}
                      </Button>
                      <Button
                        onClick={() =>
                          downloadFile(
                            getSearchResultContent(item),
                            `${item.query}.md`,
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

                    {item.images?.length > 0 ? (
                      <>
                        <hr className="my-6" />
                        <h4>{t("research.searchResult.relatedImages")}</h4>
                        <Lightbox data={item.images}></Lightbox>
                      </>
                    ) : null}
                    {item.sources?.length > 0 ? (
                      <>
                        <hr className="my-6" />
                        <h4>{t("research.common.sources")}</h4>
                        <ol>
                          {item.sources.map((source, idx) => {
                            return (
                              <li className="ml-2" key={idx}>
                                <a href={source.url} target="_blank">
                                  {source.title || source.url}
                                </a>
                              </li>
                            );
                          })}
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
              <div className="prose prose-sm dark:prose-invert max-w-full mt-2">
                <MagicDownView>{taskStore.thinkingProcess}</MagicDownView>
              </div>
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
                  disabled={isThinking || !taskFinished}
                  onClick={handleWiderResearch}
                >
                  {isThinking ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      <span>{status}</span>
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      {t("research.common.widerResearch")}
                    </>
                  )}
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="default"
                  disabled={isThinking || !taskFinished}
                  onClick={handleDeeperResearch}
                >
                  {isThinking ? (
                    <>
                      <LoaderCircle className="animate-spin" />
                      <span>{status}</span>
                      <small className="font-mono">{formattedTime}</small>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      {t("research.common.deeperResearch")}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}
    </section>
  );
}

export default SearchResult;
