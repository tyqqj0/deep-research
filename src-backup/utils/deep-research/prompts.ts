import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
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
  return z.object({
    reasoning: z
      .string()
      .describe(
        "First, write a detailed summary and synthesis of the findings from the previous step. What are the key takeaways? What are the contradictions or unanswered questions? Then, based on your synthesis, strategize and determine the single most critical and logical next step to deepen this research."
      ),
    query: z.string().describe("The single, highly specific SERP query that will accomplish this next step."),
  }).required({ reasoning: true, query: true });
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

export function planNextDeepStepPrompt(learning: string[]) {
  const learnings = learning.map(
    (detail) => `<learning>\n${detail}\n</learning>`
  );
  // This is a placeholder for a new, more sophisticated prompt.
  const deepStepPrompt = `You are an expert researcher. Below are the research findings from the previous step.
1. **Synthesize**: First, write a detailed summary and synthesis of these findings. What are the key takeaways? What are the contradictions or unanswered questions?
2. **Strategize**: Based on your synthesis, determine the single most critical and logical next step to deepen this research.
3. **Formulate**: Generate a single, highly specific search query that will accomplish this next step.

Respond in the JSON format described in the following schema:
{outputSchema}`;

  return deepStepPrompt
    .replace("{learnings}", learnings.join("\n"))
    .replace("{outputSchema}", getDeepStepOutputSchema());
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
