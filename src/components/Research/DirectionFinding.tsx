"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LoaderCircle,
  SquarePlus,
  FilePlus,
  BookText,
  Paperclip,
  Link,
} from "lucide-react";
import { Button } from "@/components/Internal/Button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ResourceList from "@/components/Knowledge/ResourceList";
import Crawler from "@/components/Knowledge/Crawler";
import { useDirectionFinding } from "@/hooks/useDirectionFinding";
import useDeepResearch from "@/hooks/useDeepResearch";
import useAiProvider from "@/hooks/useAiProvider";
import useKnowledge from "@/hooks/useKnowledge";
import useAccurateTimer from "@/hooks/useAccurateTimer";
import { useGlobalStore } from "@/store/global";
import { useSettingStore } from "@/store/setting";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import { useLibraryStore } from "@/store/libraryStore";

const MagicDown = dynamic(() => import("@/components/MagicDown"));

const topicFormSchema = z.object({
  topic: z.string().min(2),
});

const feedbackFormSchema = z.object({
  feedback: z.string(),
});

function DirectionFinding() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskStore = useTaskStore();
  
  // 确保订阅questions和reportPlan字段的变化
  const questions = useTaskStore((state) => state.questions);
  const reportPlan = useTaskStore((state) => state.reportPlan);
  const { findDirection } = useDirectionFinding();
  const { writeReportPlan } = useDeepResearch();
  const { hasApiKey } = useAiProvider();
  const { getKnowledgeFromFile } = useKnowledge();
  const {
    formattedTime,
    start: accurateTimerStart,
    stop: accurateTimerStop,
  } = useAccurateTimer();
  const { setOpenKnowledge, setOpenSetting } = useGlobalStore();
  const { enableTaskWaitingTime } = useSettingStore();
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isProcessingFeedback, setIsProcessingFeedback] = useState<boolean>(false);
  const [showCrawler, setShowCrawler] = useState<boolean>(false);

  // 话题输入表单
  const topicForm = useForm<z.infer<typeof topicFormSchema>>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      topic: taskStore.question,
    },
  });

  // 反馈表单
  const feedbackForm = useForm<z.infer<typeof feedbackFormSchema>>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      feedback: taskStore.feedback,
    },
  });

  function createNewResearch() {
    const {
      reset,
      setQuestion,
      setQuery,
      setRequirement,
      setSuggestion,
      setTitle,
      updateQuestions,
      updateReportPlan,
      updateFinalReport,
      updateThinkingProcess,
      setFeedback,
      clear,
    } = useTaskStore.getState();
    reset();
    setQuestion("");
    setQuery("");
    setRequirement("");
    setSuggestion("");
    setTitle("");
    updateQuestions("");
    updateReportPlan("");
    updateFinalReport("");
    updateThinkingProcess("");
    setFeedback("");
    clear();
    topicForm.setValue("topic", "");
    feedbackForm.setValue("feedback", "");
  }

  function handleCheck() {
    if (!hasApiKey) {
      setOpenSetting(true);
      return false;
    }
    return true;
  }

  async function handleTopicSubmit(values: z.infer<typeof topicFormSchema>) {
    if (!handleCheck()) return;

    const { id, setQuestion } = useTaskStore.getState();
    const { save } = useHistoryStore.getState();
    try {
      setIsThinking(true);
      accurateTimerStart();
      if (id !== "") {
        createNewResearch();
        topicForm.setValue("topic", values.topic);
      }
      setQuestion(values.topic);
      
      // 保存研究历史 - 创建即保存，确保题目被记录
      const currentState = useTaskStore.getState().backup();
      if (currentState.question) {
        console.log("save history", currentState);
        const savedId = save(currentState);
        console.log("saved history with id:", savedId);
        // 验证保存是否成功
        setTimeout(() => {
          const { history } = useHistoryStore.getState();
          console.log("current history after save:", history);
        }, 100);
        // 刷新文献库的可用话题列表
        useLibraryStore.getState().loadAvailableTopics().catch(console.error);
      }
      
      await findDirection();
    } finally {
      setIsThinking(false);
      accurateTimerStop();
    }
  }

  async function handleFeedbackSubmit(values: z.infer<typeof feedbackFormSchema>) {
    if (!handleCheck()) return;

    const { question, questions, setFeedback } = useTaskStore.getState();
    setFeedback(values.feedback);
    const prompt = [
      `Initial Query: ${question}`,
      `Follow-up Questions: ${questions}`,
      `Follow-up Feedback: ${values.feedback}`,
    ].join("\n\n");
    taskStore.setQuery(prompt);
    try {
      accurateTimerStart();
      setIsProcessingFeedback(true);
      await writeReportPlan();
    } finally {
      setIsProcessingFeedback(false);
      accurateTimerStop();
    }
  }

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    try {
      for (const file of Array.from(files)) {
        await getKnowledgeFromFile(file);
      }
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    topicForm.setValue("topic", taskStore.question);
  }, [taskStore.question, topicForm]);

  useEffect(() => {
    feedbackForm.setValue("feedback", taskStore.feedback);
  }, [taskStore.feedback, feedbackForm]);

  return (
    <section className="p-4 border rounded-md mt-4 print:hidden">
      <div className="flex justify-between items-center border-b mb-4">
        <h3 className="font-semibold text-lg leading-10">
          一、确定研究方向
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => createNewResearch()}
            title={t("research.common.newResearch")}
          >
            <SquarePlus />
          </Button>
        </div>
      </div>

      {/* Step 1: 研究主题输入 */}
      <div className="mb-6">
        <h4 className="text-base font-semibold mb-3">1.1 研究主题</h4>
        <Form {...topicForm}>
          <form onSubmit={topicForm.handleSubmit(handleTopicSubmit)}>
            <FormField
              control={topicForm.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="mb-2 text-sm font-medium">
                    {t("research.topic.topicLabel")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={t("research.topic.topicPlaceholder")}
                      disabled={isThinking}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* 资源上传部分 */}
            <FormItem className="mt-4">
              <FormLabel className="mb-2 text-sm font-medium">
                {t("knowledge.localResourceTitle")}
              </FormLabel>
              <FormControl onSubmit={(ev) => ev.stopPropagation()}>
                <div>
                  {taskStore.resources.length > 0 ? (
                    <ResourceList
                      className="pb-2 mb-2 border-b"
                      resources={taskStore.resources}
                      onRemove={taskStore.removeResource}
                    />
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="inline-flex border p-2 rounded-md text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                        <FilePlus className="w-5 h-5" />
                        <span className="ml-1">{t("knowledge.addResource")}</span>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setOpenKnowledge(true)}>
                        <BookText />
                        <span>{t("knowledge.knowledge")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleFileSelect}>
                        <Paperclip />
                        <span>{t("knowledge.localFile")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCrawler(true)}>
                        <Link />
                        <span>{t("knowledge.webPage")}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </div>
              </FormControl>
            </FormItem>

            <Button
              className="mt-4 w-full"
              type="submit"
              disabled={isThinking}
            >
              {isThinking ? (
                <>
                  <LoaderCircle className="animate-spin mr-2" />
                  <span>正在分析研究方向...</span>
                  <small className="font-mono ml-2">{formattedTime}</small>
                </>
              ) : (
                t("research.topic.submitButton")
              )}
            </Button>
          </form>
        </Form>
      </div>

      {/* Step 2: 方向细化建议 (条件显示) */}
      {questions && questions.trim() && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-base font-semibold mb-3">1.2 方向细化建议</h4>
          <div className="mb-4">
            <MagicDown
              className="min-h-20"
              value={questions}
              onChange={(value) => taskStore.updateQuestions(value)}
            />
          </div>

          <Form {...feedbackForm}>
            <form onSubmit={feedbackForm.handleSubmit(handleFeedbackSubmit)}>
              <FormField
                control={feedbackForm.control}
                name="feedback"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-2 text-sm font-medium">
                      {t("research.feedback.feedbackLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder={t("research.feedback.feedbackPlaceholder")}
                        disabled={isProcessingFeedback}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button
                className="mt-4 w-full"
                type="submit"
                disabled={isProcessingFeedback}
              >
                {isProcessingFeedback ? (
                  <>
                    <LoaderCircle className="animate-spin mr-2" />
                    <span>正在制定研究计划...</span>
                    <small className="font-mono ml-2">{formattedTime}</small>
                  </>
                ) : reportPlan === "" ? (
                  t("research.common.writeReportPlan")
                ) : (
                  t("research.common.rewriteReportPlan")
                )}
              </Button>
            </form>
          </Form>
          
          {/* Step 3: 报告计划显示 (条件显示) */}
          {reportPlan && reportPlan.trim() && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-base font-semibold mb-3">1.3 研究报告计划</h4>
              <MagicDown
                className="min-h-20"
                value={reportPlan}
                onChange={(value) => taskStore.updateReportPlan(value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Crawler 对话框 */}
      <Crawler open={showCrawler} onClose={() => setShowCrawler(false)} />
    </section>
  );
}

export default DirectionFinding;