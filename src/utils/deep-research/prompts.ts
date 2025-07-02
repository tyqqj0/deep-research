import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import type { Source, Knowledge, ImageSource } from "@/types";
import {
  systemInstruction,
  systemQuestionPrompt,
  reportPlanPrompt,
  serpQueriesPrompt,
  queryResultPrompt,
  citationRulesPrompt,
  searchResultPrompt,
  searchKnowledgeResultPrompt,
  reviewPrompt,
  finalReportCitationImagePrompt,
  finalReportReferencesPrompt,
  finalReportPrompt,
} from "@/constants/prompts";
import { getAutoLanguagePrompt } from "@/utils/language-detector";

export function getSERPQuerySchema() {
  return z
    .array(
      z
        .object({
          query: z.string().describe("The SERP query."),
          title: z
            .string()
            .describe(
              "A very short, concise, and user-friendly title for this research task. Just the title, without any other text. JSON reserved words should be escaped."
            ),
          researchGoal: z
            .string()
            .describe(
              "First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions. JSON reserved words should be escaped."
            ),
        })
        .required({ query: true, researchGoal: true, title: true })
    )
    .describe(`List of SERP queries.`);
}

export function getDeepStepSchema() {
  return z
    .object({
      reasoning: z
        .string()
        .describe(
          "A detailed summary and synthesis of the findings from the previous step, including key takeaways, contradictions, or unanswered questions. This reasoning should justify the new set of queries."
        ),
      queries: getSERPQuerySchema(),
    })
    .required({ reasoning: true, queries: true });
}

export function getSERPQueryOutputSchema() {
  const SERPQuerySchema = getSERPQuerySchema();
  return JSON.stringify(zodToJsonSchema(SERPQuerySchema), null, 4);
}

export function getDeepStepOutputSchema() {
  const DeepStepSchema = getDeepStepSchema();
  return JSON.stringify(zodToJsonSchema(DeepStepSchema), null, 4);
}

export function getSystemPrompt() {
  return systemInstruction.replace("{now}", new Date().toISOString());
}

export function generateQuestionsPrompt(query: string) {
  return systemQuestionPrompt.replace("{query}", query);
}

export function writeReportPlanPrompt(query: string) {
  return reportPlanPrompt.replace("{query}", query);
}

export function generateSerpQueriesPrompt(plan: string) {
  return serpQueriesPrompt
    .replace("{plan}", plan)
    .replace("{outputSchema}", getSERPQueryOutputSchema());
}

export function processResultPrompt(query: string, researchGoal: string) {
  return queryResultPrompt
    .replace("{query}", query)
    .replace("{researchGoal}", researchGoal);
}

export function processSearchResultPrompt(
  query: string,
  researchGoal: string,
  results: Source[],
  enableReferences: boolean
) {
  const context = results.map(
    (result, idx) =>
      `<content index="${idx + 1}" url="${result.url}">\n${result.content
      }\n</content>`
  );
  return (
    searchResultPrompt + (enableReferences ? `\n\n${citationRulesPrompt}` : "")
  )
    .replace("{query}", query)
    .replace("{researchGoal}", researchGoal)
    .replace("{context}", context.join("\n"));
}

export function processSearchKnowledgeResultPrompt(
  query: string,
  researchGoal: string,
  results: Knowledge[]
) {
  const context = results.map(
    (result, idx) =>
      `<content index="${idx + 1}" url="${location.host}">\n${result.content
      }\n</content>`
  );
  return searchKnowledgeResultPrompt
    .replace("{query}", query)
    .replace("{researchGoal}", researchGoal)
    .replace("{context}", context.join("\n"));
}

export function reviewSerpQueriesPrompt(
  plan: string,
  learning: string[],
  suggestion: string
) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  return reviewPrompt
    .replace("{plan}", plan)
    .replace("{learnings}", learnings.join("\n"))
    .replace("{suggestion}", suggestion)
    .replace("{outputSchema}", getSERPQueryOutputSchema());
}

// 第一阶段：反思当前研究成果
export function reflectCurrentResearchPrompt(
  originalTopic: string,
  learning: string[],
  currentDepth: number
) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  
  const languagePrompt = getAutoLanguagePrompt(originalTopic);
  
  const reflectionPrompt = `You are an expert academic researcher conducting systematic research evaluation. Your task is to reflect on the current research progress and provide a structured assessment.

## Research Context
Original topic: **${originalTopic}**
Current research depth: Level ${currentDepth}

## Current Research Findings
{learnings}

## Reflection Task
Provide a concise, structured reflection with exactly these two components:

### 1. Research Completion Assessment
<COMPLETION_STATUS>
[Provide ONE of these structured markers:
- RESEARCH_COMPLETE: The core research objectives have been substantially fulfilled
- RESEARCH_PARTIAL: Significant progress made but key gaps remain  
- RESEARCH_INSUFFICIENT: Major research areas still unexplored]
</COMPLETION_STATUS>

### 2. Gap Analysis (if not RESEARCH_COMPLETE)
<RESEARCH_GAPS>
[List 2-3 specific, actionable research gaps or deficiencies. Be precise and concrete:
- What specific aspects need deeper investigation?
- Which methodological approaches are missing?
- What theoretical frameworks need exploration?
Keep each point under 30 words.]
</RESEARCH_GAPS>

Keep your entire reflection under 200 words total. Be precise and actionable.

Language: ${languagePrompt}`;

  return reflectionPrompt.replace("{learnings}", learnings.join("\n"));
}

// 第二阶段：基于反思的深度思考规划
export function planNextDeepStepPrompt(
  originalTopic: string,
  learning: string[],
  reflectionContent: string,
  maxTasks: number = 3
) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  
  const languagePrompt = getAutoLanguagePrompt(originalTopic);
  
  const planningPrompt = `You are an expert academic researcher planning the next research phase based on reflection results.

## Research Context
Original topic: **${originalTopic}**
Previous findings: {learnings}

## Reflection Results
${reflectionContent}

## Strategic Planning Task
**IMPORTANT: You MUST use the exact XML tags below in your response. Do not deviate from this format.**

Based on the reflection, provide a focused strategic plan in exactly these sections:

### 1. Strategic Analysis (max 100 words)
<STRATEGIC_THINKING>
[Synthesize key insights from reflection and previous research. Focus on the most critical research directions that will address identified gaps. Be specific about theoretical frameworks, methodological approaches, or empirical patterns that need investigation.]
</STRATEGIC_THINKING>

### 2. Research Task Planning (max 150 words)
<RESEARCH_TASKS>
[Plan exactly ${maxTasks} specific academic research tasks that directly address the identified gaps. For each task (max 50 words each):
- Specific research focus/question
- Target academic sources (journals, conferences, databases)
- Key methodological or theoretical approach
Focus on high-impact scholarly sources and peer-reviewed literature.]
</RESEARCH_TASKS>

**CRITICAL: Your response MUST include both <STRATEGIC_THINKING> and <RESEARCH_TASKS> XML tags exactly as shown above.**

Keep your entire response under 300 words. Be strategic and actionable.

Language: ${languagePrompt}`;

  return planningPrompt.replace("{learnings}", learnings.join("\n"));
}

// 第二阶段：将学术规划转换为论文搜索任务
export function generateTasksFromPlanPrompt(
  planningContent: string,
  originalTopic: string
) {
  const languagePrompt = getAutoLanguagePrompt(originalTopic);
  
  const taskGenerationPrompt = `You are an academic research assistant specializing in scholarly literature search. You have received an academic research planning document that contains research task plans within <RESEARCH_TASKS> tags.

Original academic topic: **${originalTopic}**

Academic planning content:
${planningContent}

Your task is to extract the academic research tasks from the <RESEARCH_TASKS> section and convert them into formal search queries optimized for finding scholarly papers and academic publications.

For each academic research task mentioned in the <RESEARCH_TASKS> section, create:

1. **query**: A specific, academic search query optimized for finding scholarly papers. Use academic keywords, author names, institution names, and paper titles. Consider using search operators like:
   - "author:surname" for specific researchers
   - "filetype:pdf" for academic papers
   - "site:arxiv.org" or "site:scholar.google.com" for academic databases
   - Include terms like "paper", "journal", "research", "study", "analysis"

2. **title**: A concise, academic title for this research task focusing on the scholarly aspect

3. **researchGoal**: A detailed academic research objective describing what scholarly information, theories, methodologies, or empirical findings this task aims to discover from academic literature

Important guidelines:
- Prioritize peer-reviewed journals, conference papers, and academic publications
- Focus on finding research papers rather than general web content
- Include methodology-specific terms when relevant
- Target specific academic communities or research areas

Language instruction: ${languagePrompt}

Respond in the JSON format described in the following schema:
{outputSchema}`;

  return taskGenerationPrompt.replace("{outputSchema}", getSERPQueryOutputSchema());
}

// 工具函数：提取研究任务内容
export function extractResearchTasks(planningContent: string): string {
  const startTag = "<RESEARCH_TASKS>";
  const endTag = "</RESEARCH_TASKS>";
  
  const startIndex = planningContent.indexOf(startTag);
  const endIndex = planningContent.indexOf(endTag);
  
  if (startIndex !== -1 && endIndex !== -1) {
    const extractedContent = planningContent.slice(startIndex + startTag.length, endIndex).trim();
    return extractedContent;
  }
  
  // 如果没有找到XML标签，尝试提取任务相关内容
  console.log("【DEBUG_EXTRACT】XML标签未找到，尝试提取任务相关内容");
  
  // 寻找"任务"、"Task"、"研究任务"等关键词
  const taskKeywords = [
    "### 2. 研究任务规划",
    "### 2. Research Task Planning", 
    "**任务1",
    "**任务2",
    "**任务3",
    "**Task 1",
    "**Task 2", 
    "**Task 3",
    "研究任务规划",
    "任务规划",
    "Research Task"
  ];
  
  // 找到任务规划部分
  let taskStartIndex = -1;
  let foundKeyword = "";
  
  for (const keyword of taskKeywords) {
    const index = planningContent.indexOf(keyword);
    if (index !== -1) {
      taskStartIndex = index;
      foundKeyword = keyword;
      break;
    }
  }
  
  if (taskStartIndex !== -1) {
    console.log(`【DEBUG_EXTRACT】找到关键词 "${foundKeyword}" 在位置:`, taskStartIndex);
    
    // 从关键词位置开始，提取到文末或下一个主要标题
    const taskContent = planningContent.substring(taskStartIndex);
    
    // 寻找结束位置（下一个主要标题或文末）
    const endMarkers = ["\n### 3.", "\n## ", "\nLanguage:", "\n---"];
    let endIndex = taskContent.length;
    
    for (const marker of endMarkers) {
      const markerIndex = taskContent.indexOf(marker, foundKeyword.length);
      if (markerIndex !== -1 && markerIndex < endIndex) {
        endIndex = markerIndex;
      }
    }
    
    const extractedContent = taskContent.substring(0, endIndex).trim();
    console.log("【DEBUG_EXTRACT】成功提取任务内容，长度:", extractedContent.length);
    return extractedContent;
  }
  
  // 最后的备选方案：返回整个内容（因为可能整个内容都是任务描述）
  console.log("【DEBUG_EXTRACT】未找到明确的任务标记，返回完整内容");
  return planningContent.trim();
}

// 工具函数：提取反思评估结果
export function extractReflectionResults(reflectionContent: string): {
  completionStatus: 'RESEARCH_COMPLETE' | 'RESEARCH_PARTIAL' | 'RESEARCH_INSUFFICIENT' | null;
  researchGaps: string;
} {
  const completionMatch = reflectionContent.match(/<COMPLETION_STATUS>(.*?)<\/COMPLETION_STATUS>/);
  const gapsMatch = reflectionContent.match(/<RESEARCH_GAPS>(.*?)<\/RESEARCH_GAPS>/);
  
  let completionStatus: 'RESEARCH_COMPLETE' | 'RESEARCH_PARTIAL' | 'RESEARCH_INSUFFICIENT' | null = null;
  
  if (completionMatch) {
    const statusText = completionMatch[1].trim();
    if (statusText.includes('RESEARCH_COMPLETE')) {
      completionStatus = 'RESEARCH_COMPLETE';
    } else if (statusText.includes('RESEARCH_PARTIAL')) {
      completionStatus = 'RESEARCH_PARTIAL';
    } else if (statusText.includes('RESEARCH_INSUFFICIENT')) {
      completionStatus = 'RESEARCH_INSUFFICIENT';
    }
  }
  
  const researchGaps = gapsMatch ? gapsMatch[1].trim() : '';
  
  return {
    completionStatus,
    researchGaps
  };
}

// 工具函数：提取策略思考内容
export function extractStrategicThinking(planningContent: string): string {
  const startTag = "<STRATEGIC_THINKING>";
  const endTag = "</STRATEGIC_THINKING>";
  
  const startIndex = planningContent.indexOf(startTag);
  const endIndex = planningContent.indexOf(endTag);
  
  if (startIndex === -1 || endIndex === -1) {
    return "";
  }
  
  return planningContent.slice(startIndex + startTag.length, endIndex).trim();
}

export function writeFinalReportPrompt(
  plan: string,
  learning: string[],
  source: Source[],
  images: ImageSource[],
  requirement: string,
  enableCitationImage: boolean,
  enableReferences: boolean
) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  const sources = source.map(
    (item, idx) =>
      `<source index="${idx + 1}" url="${item.url}">\n${item.title}\n</source>`
  );
  const imageList = images.map(
    (source, idx) => `${idx + 1}. ![${source.description}](${source.url})`
  );
  return (
    finalReportPrompt +
    (enableCitationImage
      ? `\n**Including meaningful images from the previous research in the report is very helpful.**\n\n${finalReportCitationImagePrompt}`
      : "") +
    (enableReferences ? `\n\n${finalReportReferencesPrompt}` : "")
  )
    .replace("{plan}", plan)
    .replace("{learnings}", learnings.join("\n"))
    .replace("{sources}", sources.join("\n"))
    .replace("{images}", imageList.join("\n"))
    .replace("{requirement}", requirement);
}
