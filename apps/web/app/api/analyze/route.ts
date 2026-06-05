import { assertAnonymousAnalysisAllowed } from "./analysis-quota-guard";
import { startAnalyzeJob } from "./execute-job";
import { parseAnalyzeRequest } from "./schema";
import { getCurrentHistorySubject } from "../auth/session";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );
    const historySubject = await getCurrentHistorySubject();

    if (historySubject.mode === "session") {
      await assertAnonymousAnalysisAllowed(historySubject.subjectId);
    }

    const jobId = startAnalyzeJob(parsed, historySubject.subjectId);

    return Response.json({ jobId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}
