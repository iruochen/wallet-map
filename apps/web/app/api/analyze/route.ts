import { after } from "next/server";
import { assertAnonymousAnalysisAllowed } from "./analysis-quota-guard";
import { createAnalyzeJobId, executeAnalyzeJob, initializeAnalyzeJobRecord } from "./execute-job";
import {
  assertAnalyzeRequestCapacity,
  readAnalyzeRequestBody,
} from "./request-guard";
import { parseAnalyzeRequest } from "./schema";
import { getCurrentHistorySubject } from "../auth/session";
import { getProductPlanLimits, type ProductPlanTier } from "../../pro-plan";

export const maxDuration = 60;

// Validate request, start a background job, return 202 + jobId (not the final result).
export async function POST(request: Request): Promise<Response> {
  try {
    const historySubject = await getCurrentHistorySubject();
    const tier: ProductPlanTier = historySubject.mode === "wallet" ? "free" : "anonymous";
    const body = await readAnalyzeRequestBody(request, getProductPlanLimits(tier).maxRequestBytes);
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );

    assertAnalyzeRequestCapacity(parsed, tier);

    if (historySubject.mode === "session") {
      await assertAnonymousAnalysisAllowed(historySubject.subjectId);
    }

    const jobId = createAnalyzeJobId();
    await initializeAnalyzeJobRecord(jobId, parsed, historySubject.subjectId);

    if (process.env.NODE_ENV === "production") {
      after(async () => {
        await executeAnalyzeJob(jobId, parsed);
      });
    } else {
      void executeAnalyzeJob(jobId, parsed);
    }

    return Response.json({ jobId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}
