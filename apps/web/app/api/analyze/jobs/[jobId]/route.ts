import { getAnalysisStorage } from "../../analysis-storage";
import { getAnalyzeJob } from "../../job-store";
import { getProgressPercent } from "../../progress";
import { getCurrentHistorySubject } from "../../../auth/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  const historySubject = await getCurrentHistorySubject();
  const redisJob = await getAnalyzeJob(jobId);
  const storage = await getAnalysisStorage();
  const subjectMatches = !redisJob?.subjectId || redisJob.subjectId === historySubject.subjectId;
  const persistedJob = storage
    ? await storage.getJobRecord(jobId, historySubject.subjectId).catch(() => undefined)
    : undefined;

  if ((!redisJob || !subjectMatches) && !persistedJob) {
    return Response.json({ error: "Analysis job not found." }, { status: 404 });
  }

  if (redisJob && subjectMatches) {
    return Response.json({
      jobId,
      status: redisJob.status,
      progress: redisJob.progress,
      percent: getProgressPercent(redisJob.progress),
      error: redisJob.error,
      result: redisJob.status === "completed" ? redisJob.result : undefined,
    });
  }

  return Response.json({
    jobId,
    status: persistedJob!.status,
    progress: persistedJob!.progress ?? { phase: null, completedPhases: [] },
    percent: getProgressPercent(persistedJob!.progress ?? null),
    error: persistedJob!.errorMessage,
    result: persistedJob!.status === "completed" ? persistedJob!.resultSnapshot : undefined,
  });
}
