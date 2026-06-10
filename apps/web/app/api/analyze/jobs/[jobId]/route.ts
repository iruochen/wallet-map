import { getAnalysisStorage } from "../../analysis-storage";
import { deleteAnalyzeJob, getAnalyzeJob } from "../../job-store";
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
      createdAt: redisJob.createdAt,
      startedAt: redisJob.startedAt ?? redisJob.createdAt,
      error: redisJob.error,
      result: redisJob.status === "completed" ? redisJob.result : undefined,
    });
  }

  return Response.json({
    jobId,
    status: persistedJob!.status,
    progress: persistedJob!.progress ?? { phase: null, completedPhases: [] },
    percent: getProgressPercent(persistedJob!.progress ?? null),
    createdAt: persistedJob!.createdAt,
    startedAt: persistedJob!.startedAt ?? persistedJob!.createdAt,
    error: persistedJob!.errorMessage,
    result: persistedJob!.status === "completed" ? persistedJob!.resultSnapshot : undefined,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  const historySubject = await getCurrentHistorySubject();
  const storage = await getAnalysisStorage();

  if (!storage) {
    return Response.json({ error: "Database storage is not configured." }, { status: 503 });
  }

  try {
    const deleted = await storage.deleteJob(jobId, historySubject.subjectId);

    if (!deleted) {
      return Response.json({ error: "Analysis job not found." }, { status: 404 });
    }

    await deleteAnalyzeJob(jobId).catch(() => undefined);

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete analysis job.";

    return Response.json({ error: message }, { status: 500 });
  }
}
