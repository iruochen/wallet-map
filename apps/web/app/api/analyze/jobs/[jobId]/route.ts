import { getAnalyzeJob } from "../../job-store";
import { getProgressPercent } from "../../progress";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await context.params;
  const job = getAnalyzeJob(jobId);

  if (!job) {
    return Response.json({ error: "Analysis job not found." }, { status: 404 });
  }

  return Response.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    percent: getProgressPercent(job.progress),
    error: job.error,
    result: job.status === "completed" ? job.result : undefined,
  });
}
