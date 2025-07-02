import { NextResponse, type NextRequest } from "next/server";
import { ResearchEngine } from "@/utils/deep-research";
import { multiApiKeyPolling } from "@/utils/model";
import {
  getAIProviderBaseURL,
  getAIProviderApiKey,
  getSearchProviderBaseURL,
  getSearchProviderApiKey,
} from "../../utils";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const preferredRegion = [
  "cle1",
  "iad1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
  "hnd1",
  "kix1",
];

export async function GET(req: NextRequest) {
  function getValueFromSearchParams(key: string) {
    return req.nextUrl.searchParams.get(key);
  }
  const query = getValueFromSearchParams("query") || "";
  const provider = getValueFromSearchParams("provider") || "";
  const thinkingModel = getValueFromSearchParams("thinkingModel") || "";
  const taskModel = getValueFromSearchParams("taskModel") || "";
  const searchProvider = getValueFromSearchParams("searchProvider") || "";
  const language = getValueFromSearchParams("language") || "";
  const maxResult = Number(getValueFromSearchParams("maxResult")) || 5;
  const enableCitationImage =
    getValueFromSearchParams("enableCitationImage") === "false";
  const enableReferences =
    getValueFromSearchParams("enableReferences") === "false";

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    start: async (controller) => {
      console.log("Client connected");

      req.signal.addEventListener("abort", () => {
        console.log("Client disconnected");
      });

      const deepResearch = new ResearchEngine();
      
      try {
        // Call some method to start the research
        // Note: This needs to be adapted based on the new API
        controller.enqueue(encoder.encode("Research started"));
        controller.close();
      } catch (error) {
        console.error(error);
        controller.close();
      }

      req.signal.addEventListener("abort", () => {
        controller.close();
      });

      try {
        // TODO: Implement proper research flow for live route
        console.log("Live research requested for query:", query);
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : "Unknown error");
      }
      controller.close();
    },
  });

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
