import { useState } from "react";
import { useTranslation } from "react-i18next";
import { streamText } from "ai";
import { toast } from "sonner";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import useModelProvider from "@/hooks/useAiProvider";
import { ThinkTagStreamProcessor } from "@/utils/text";
import { parseError } from "@/utils/error";
import { getSystemPrompt } from "@/utils/deep-research/prompts";

function getResponseLanguagePrompt() {
  return `\n\n**Respond in the same language as the user's language**`;
}

function generateDirectionPrompt(query: string) {
  return `Given the user's research topic, help them clarify and refine their research direction by asking 5 targeted questions to better understand their specific interests and focus areas:

<RESEARCH_TOPIC>
${query}
</RESEARCH_TOPIC>

Questions need to be brief and concise. Focus on clarifying the research direction, scope, and specific aspects the user wants to explore.`;
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

export function useDirectionFinding() {
  const { t } = useTranslation();
  const { createModelProvider, getModel } = useModelProvider();
  const { save } = useHistoryStore();
  const [status, setStatus] = useState<string>("");

  async function findDirection() {
    const { question } = useTaskStore.getState();
    const { thinkingModel } = getModel();
    setStatus(t("research.common.thinking"));
    
    const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
    const result = streamText({
      model: await createModelProvider(thinkingModel),
      system: getSystemPrompt(),
      prompt: [
        generateDirectionPrompt(question),
        getResponseLanguagePrompt(),
      ].join("\n\n"),
      onError: handleError,
    });
    
    let content = "";
    let reasoning = "";
    const taskStore = useTaskStore.getState();
    taskStore.setQuestion(question);
    
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        thinkTagStreamProcessor.processChunk(
          part.textDelta,
          (data) => {
            content += data;
            // 使用 updateQuestions 存储研究方向相关内容
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
    
    // 保存研究历史 - 方向确定阶段完成
    const currentState = taskStore.backup();
    if (currentState.title || currentState.question) {
      const savedId = save(currentState);
      console.log("[findDirection] saved direction finding with id:", savedId);
    }
  }

  return {
    status,
    findDirection,
  };
}