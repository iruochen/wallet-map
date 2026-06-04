import { getAnalysisStorage } from "../analysis-storage";
import { getCurrentHistorySubject } from "../../auth/session";

export async function GET(request: Request): Promise<Response> {
  const storage = await getAnalysisStorage();

  if (!storage) {
    return Response.json({ jobs: [], storageEnabled: false });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
  const historySubject = await getCurrentHistorySubject();

  try {
    const jobs = await storage.listJobs(limit, historySubject.subjectId);
    return Response.json({
      jobs,
      storageEnabled: true,
      historyMode: historySubject.mode,
      walletAddress: historySubject.session?.address,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list analysis jobs.";

    return Response.json({ error: message, jobs: [], storageEnabled: true }, { status: 500 });
  }
}
