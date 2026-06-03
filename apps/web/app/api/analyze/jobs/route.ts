import { getAnalysisStorage } from "../analysis-storage";

export async function GET(request: Request): Promise<Response> {
  const storage = getAnalysisStorage();

  if (!storage) {
    return Response.json({ jobs: [], storageEnabled: false });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  try {
    const jobs = await storage.listJobs(limit);
    return Response.json({ jobs, storageEnabled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list analysis jobs.";

    return Response.json({ error: message, jobs: [], storageEnabled: true }, { status: 500 });
  }
}
