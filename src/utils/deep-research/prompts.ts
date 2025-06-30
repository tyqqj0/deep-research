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

// 第一阶段：深度学术研究规划思考
export function planNextDeepStepPrompt(
  originalTopic: string,
  learning: string[],
  maxTasks: number = 3
) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  
  const languagePrompt = getAutoLanguagePrompt(originalTopic);
  
  const planningPrompt = `You are an expert academic researcher conducting deep scholarly research. Your focus is on finding and analyzing high-quality academic papers, research publications, and scholarly sources. Follow these steps to plan the next deeper level of investigation:

## 1. 回顾研究主题 (Academic Topic Review)
Original research topic: **${originalTopic}**
Research context: Academic/scholarly investigation focusing on peer-reviewed literature and scientific publications.

## 2. 回顾已有研究成果 (Previous Academic Findings Review)
Below are the scholarly findings from the previous research step:
{learnings}

## 3. 深度学术分析思考 (Deep Academic Analysis & Thinking)
Based on the previous academic findings, conduct a thorough scholarly analysis:
- What are the key theoretical insights and empirical patterns from the previous research?
- What research gaps, methodological limitations, or contradictory findings exist in the current literature?
- Which aspects require deeper investigation through more specialized academic sources?
- What new research directions or theoretical frameworks could advance our understanding?
- Are there specific authors, research groups, or institutions that are leading work in this area?

## 4. 学术研究任务规划 (Academic Research Task Planning)
Based on your analysis, plan no more than ${maxTasks} new academic research tasks focused on finding high-quality scholarly sources. For each task, describe:
- The specific academic research focus/question
- Target types of sources (journal papers, conference proceedings, research reports, etc.)
- Key academic databases or publication venues to prioritize
- Specific research methodologies or theoretical approaches to investigate

<RESEARCH_TASKS>
[Place your no more than ${maxTasks} academic research task plans here - focus on finding scholarly papers and academic publications. These should be conceptual descriptions targeting academic literature, not formal search queries yet]
</RESEARCH_TASKS>

Important: ${languagePrompt}

Please provide your complete academic thinking process including all four steps above.`;

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
