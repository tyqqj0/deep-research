import { NextResponse, type NextRequest } from "next/server";
import { ResearchEngine } from "@/utils/deep-research";
import { multiApiKeyPolling } from "@/utils/model";
import {
  getAIProviderBaseURL,
  getAIProviderApiKey,
  getSearchProviderBaseURL,
  getSearchProviderApiKey,
} from "../utils";

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

export async function POST(req: NextRequest) {
  const {
    query,
    provider,
    thinkingModel,
    taskModel,
    searchProvider,
    language,
    maxResult,
    enableCitationImage = true,
    enableReferences = true,
  } = await req.json();

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    start: async (controller) => {
      console.log("Client connected");
      controller.enqueue(
        encoder.encode(
          `event: infor\ndata: ${JSON.stringify({
            name: "deep-research",
            version: "0.2.3",
          })}\n\n`
        )
      );

      const deepResearch = new ResearchEngine();

      req.signal.addEventListener("abort", () => {
        controller.close();
      });

      try {
        // TODO: Implement proper research flow for SSE route
        console.log("SSE research requested for query:", query);
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
