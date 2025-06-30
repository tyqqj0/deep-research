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

// 第一阶段：深度研究规划思考
export function planNextDeepStepPrompt(
  originalTopic: string,
  learning: string[],
  maxTasks: number = 3
) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  
  const planningPrompt = `You are an expert researcher conducting deep research. Your task is to plan the next deeper level of investigation following these steps:

## 1. 回顾研究主题 (Topic Review)
Original research topic: **${originalTopic}**

## 2. 回顾已有研究成果 (Previous Findings Review)
Below are the findings from the previous research step:
{learnings}

## 3. 深度分析思考 (Deep Analysis & Thinking)
Based on the previous findings, conduct a thorough analysis:
- What are the key insights and patterns from the previous research?
- What knowledge gaps, contradictions, or unanswered questions remain?
- What aspects require deeper investigation to advance our understanding?
- How can we build upon these findings to uncover more valuable insights?

## 4. 研究任务规划 (Research Task Planning)
Based on your analysis, plan ${maxTasks} new research tasks that will deepen our understanding. For each task, briefly describe:
- The specific research focus/question
- Why this direction is valuable for deeper understanding
- What type of information we hope to discover

<RESEARCH_TASKS>
[Place your ${maxTasks} research task plans here - these should be conceptual descriptions, not formal search queries yet]
</RESEARCH_TASKS>

Please provide your complete thinking process including all four steps above.`;

  return planningPrompt.replace("{learnings}", learnings.join("\n"));
}

// 第二阶段：将规划转换为严格格式的任务
export function generateTasksFromPlanPrompt(
  planningContent: string,
  originalTopic: string
) {
  const taskGenerationPrompt = `You are a research assistant. You have received a research planning document that contains research task plans within <RESEARCH_TASKS> tags.

Original topic: **${originalTopic}**

Planning content:
${planningContent}

Your task is to extract the research tasks from the <RESEARCH_TASKS> section and convert them into formal search queries with proper structure.

For each research task mentioned in the <RESEARCH_TASKS> section, create:
1. **query**: A specific, focused search query optimized for web search engines
2. **title**: A concise, user-friendly title for this research task  
3. **researchGoal**: A detailed description of what information this task aims to discover

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
