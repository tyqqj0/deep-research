import { useState } from "react";
import { streamText } from "ai";
import { parsePartialJson } from "@ai-sdk/ui-utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import useModelProvider from "@/hooks/useAiProvider";
import { useTaskStore } from "@/store/task";
import { useHistoryStore } from "@/store/history";
import {
  getSystemPrompt,
  generateSerpQueriesPrompt,
  getSERPQuerySchema,
  getSERPQueryOutputSchema,
} from "@/utils/deep-research/prompts";
import { ThinkTagStreamProcessor, removeJsonMarkdown } from "@/utils/text";
import { parseError } from "@/utils/error";
import { nanoid } from "nanoid";

/**
 * 🎯 文献研究Hook - 简化版，专注文献播种功能
 * 复用原有架构: taskStore → useLiteratureResearch → UI
 */

function getResponseLanguagePrompt() {
  return `\n\n**Respond in the same language as the user's language**`;
}

function handleError(error: unknown) {
  const errorMessage = parseError(error);
  toast.error(errorMessage);
}

function useLiteratureResearch() {
  const { t } = useTranslation();
  const taskStore = useTaskStore();
  const { createModelProvider, getModel } = useModelProvider();
  const [status, setStatus] = useState<string>("");
  const { save } = useHistoryStore();

  /**
   * 🌱 文献播种 - 核心功能
   * 1. 生成搜索任务到taskStore
   * 2. 依次执行搜索，调用LiteratureDiscoveryService入库
   * 3. 更新任务状态和结果
   */
  async function runLiteratureSeeding(topic: string, reportPlan?: string) {
    const { thinkingModel } = getModel();
    setStatus("🤖 正在生成文献搜索任务...");
    
    console.log('🔧 [DEBUG] Starting literature seeding:', { topic, reportPlan: reportPlan?.slice(0, 100) + '...' });
    
    try {
      // 1. 先生成搜索任务
      const prompt = reportPlan?.trim() 
        ? `Based on the following research plan, generate 3-6 specific literature search queries for academic databases.

Research Topic: ${topic}

Research Plan:
${reportPlan}

Generate search queries that will help find relevant academic literature. Each query should be:
1. Specific and targeted for academic databases like Google Scholar, PubMed, IEEE
2. Cover different aspects of the research plan
3. Include key terms and concepts from the plan
4. Be suitable for literature search rather than general web search

You MUST respond in **JSON** matching this **JSON schema**:

\`\`\`json
{outputSchema}
\`\`\`

Expected output:

\`\`\`json
[
  {
    "query": "This is a sample query.",
    "title": "This is a sample title.",
    "researchGoal": "This is the reason for the query."
  }
]
\`\`\``
        : generateSerpQueriesPrompt(topic);

      // console.log('🔧 [DEBUG] Generated prompt (first 300 chars):', prompt.slice(0, 300));
      console.log('🔧 [DEBUG] Using thinking model:', thinkingModel);

      const thinkTagStreamProcessor = new ThinkTagStreamProcessor();
      const result = streamText({
        model: await createModelProvider(thinkingModel),
        system: getSystemPrompt(),
        prompt: prompt.replace('{outputSchema}', getSERPQueryOutputSchema()),
        onError: handleError,
      });

      const querySchema = getSERPQuerySchema();
      // console.log('🔧 [DEBUG] Query schema structure:', JSON.stringify(querySchema, null, 2));
      
      let content = "";
      let reasoning = "";
      let queries: SearchTask[] = [];
      let chunkCount = 0;
      
      for await (const textPart of result.textStream) {
        chunkCount++;
        if (chunkCount <= 10) { // 只打印前10个chunk避免干扰
          // console.log(`🔧 [DEBUG] Chunk ${chunkCount}:`, textPart.slice(0, 50) + '...');
        }
        
        thinkTagStreamProcessor.processChunk(
          textPart,
          (text) => {
            content += text;
            
            if (chunkCount % 5 === 0) { // 每5个chunk打印一次状态
              // console.log(`🔧 [DEBUG] Content length: ${content.length}, last 100 chars:`, content.slice(-100));
            }
            
            const cleanedContent = removeJsonMarkdown(content);
            const data: PartialJson = parsePartialJson(cleanedContent);
            
            if (chunkCount % 10 === 0) { // 每10个chunk打印解析状态
              // console.log('🔧 [DEBUG] Parse result:', { 
              //   state: data.state, 
              //   valueType: typeof data.value, 
              //   isArray: Array.isArray(data.value),
              //   arrayLength: Array.isArray(data.value) ? data.value.length : 'N/A'
              // });
            }
            
            const schemaValidation = querySchema.safeParse(data.value);
            
            if (schemaValidation.success) {
              // console.log('🎉 [DEBUG] Schema validation SUCCESS!');
              if (
                data.state === "repaired-parse" ||
                data.state === "successful-parse"
              ) {
                if (data.value) {
                  // console.log('🔧 [DEBUG] Processing valid data.value:', data.value);
                  
                  queries = data.value.map(
                    (item: {
                      query: string;
                      title: string;
                      researchGoal: string;
                    }) => {
                      const researchGoal = item.researchGoal || "";
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
                      } as SearchTask;
                    }
                  );
                  
                  // console.log(`🎉 [DEBUG] Generated ${queries.length} queries:`, queries.map(q => ({ title: q.title, query: q.query.slice(0, 50) })));
                  
                  // 实时更新到taskStore
                  taskStore.update(queries);
                }
              }
            } else if (chunkCount % 10 === 0) {
              console.log('❌ [DEBUG] Schema validation failed:', schemaValidation.error?.issues?.[0]);
            }
          },
          (text) => {
            reasoning += text;
          }
        );
      }
      
      if (reasoning) {
        console.log("🤖 [LiteratureResearch] AI reasoning:", reasoning);
      }
      
      console.log('🔧 [DEBUG] Final results:', {
        contentLength: content.length,
        reasoningLength: reasoning.length,
        queriesCount: queries.length,
        finalContent: content.slice(-500) // 最后500字符
      });
      
      if (queries.length === 0) {
        console.error('❌ [LiteratureResearch] No queries generated!');
        console.error('❌ [DEBUG] Full content:', content);
        console.error('❌ [DEBUG] Content after removeJsonMarkdown:', removeJsonMarkdown(content));
        
        const finalData = parsePartialJson(removeJsonMarkdown(content));
        console.error('❌ [DEBUG] Final parsed data:', finalData);
        
        const schemaValidation = querySchema.safeParse(finalData.value);
        console.error('❌ [DEBUG] Final schema validation:', { success: schemaValidation.success, error: schemaValidation.error });
        
        throw new Error('AI failed to generate search tasks');
      }

      console.log(`🌱 [LiteratureResearch] Generated ${queries.length} search tasks`);
      
      // 2. 依次执行文献搜索和入库
      console.log("🔍 [LiteratureResearch] Starting literature search tasks...");
      setStatus("🔍 正在执行文献搜索...");
      await runLiteratureSearchTasks(queries, topic);
      console.log("✅ [LiteratureResearch] Literature search tasks completed");
      
      // 3. 保存研究历史
      console.log("💾 [LiteratureResearch] Saving research history...");
      const currentState = taskStore.backup();
      if (currentState.title || currentState.question) {
        save(currentState);
      }
      
      setStatus("✅ 文献播种完成");
      console.log("🎉 [LiteratureResearch] Literature seeding process completed successfully");
      toast.success(`文献播种完成！共生成 ${queries.length} 个搜索任务`);
      
    } catch (error) {
      console.error("❌ [LiteratureResearch] Seeding failed:", error);
      setStatus("❌ 文献播种失败");
      handleError(error);
    }
  }

  /**
   * 🔍 执行文献搜索任务
   */
  async function runLiteratureSearchTasks(tasks: SearchTask[], topic: string) {
    const { updateTask } = useTaskStore.getState();
    
    try {
      console.log(`📚 [LiteratureResearch] Starting to process ${tasks.length} literature search tasks`);
      
      // 动态导入文献发现服务
      console.log("📦 [LiteratureResearch] Importing LiteratureDiscoveryService...");
      const { LiteratureDiscoveryService } = await import('@/libs/research/LiteratureDiscoveryService');
      console.log("✅ [LiteratureResearch] LiteratureDiscoveryService imported successfully");
      
      const discoveryService = new LiteratureDiscoveryService();
      console.log("🔧 [LiteratureResearch] LiteratureDiscoveryService instance created");
      
      // 依次执行每个任务
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        try {
          console.log(`🔍 [LiteratureResearch] Processing task ${i + 1}/${tasks.length}: ${task.query.slice(0, 50)}...`);
          
          // 更新任务状态为处理中
          updateTask(task.id, { 
            state: "processing",
            learning: "🔍 正在搜索文献..." 
          });
          
          // 调用文献发现服务
          console.log(`🎯 [LiteratureResearch] Calling discoverAndAddLiterature for task ${i + 1}`);
          const addedIds = await discoveryService.discoverAndAddLiterature(task.query, topic);
          console.log(`✅ [LiteratureResearch] Task ${i + 1} completed - Added ${addedIds.length} items`);
          
          // 更新任务状态为完成
          updateTask(task.id, { 
            state: "completed",
            learning: `✅ 搜索完成，已添加 ${addedIds.length} 篇文献到库中\\n\\n添加的文献ID: ${addedIds.join(', ')}`
          });
          
        } catch (error) {
          console.error(`❌ [LiteratureResearch] Task ${i + 1} failed:`, error);
          
          // 更新任务状态为失败
          updateTask(task.id, { 
            state: "completed", // 标记为完成，但在learning中显示错误
            learning: `❌ 搜索失败: ${error instanceof Error ? error.message : '未知错误'}`
          });
        }
      }
      
    } catch (error) {
      console.error("❌ [LiteratureResearch] Literature search failed:", error);
      throw error;
    }
  }

  /**
   * 🧹 取消任务
   */
  async function cancelTask(taskId: string) {
    const { updateTask, tasks, removeTask } = useTaskStore.getState();
    const task = tasks.find(t => t.id === taskId);

    if (task?.timerId) {
      clearTimeout(task.timerId);
    }

    updateTask(taskId, { state: "cancelled" });
    setTimeout(() => removeTask(taskId), 300);
  }

  return {
    status,
    runLiteratureSeeding,
    cancelTask
  };
}

export default useLiteratureResearch;