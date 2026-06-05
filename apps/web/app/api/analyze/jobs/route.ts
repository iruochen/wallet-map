import { readAnonymousAnalysisQuota } from "../analysis-quota-guard";
import { getAnalysisStorage } from "../analysis-storage";
import { getCurrentHistorySubject, readAnonymousSession } from "../../auth/session";

export async function GET(request: Request): Promise<Response> {
  const storage = await getAnalysisStorage();
  const historySubject = await getCurrentHistorySubject();
  const anonymousSession = await readAnonymousSession();

  if (!storage) {
    return Response.json({
      jobs: [],
      storageEnabled: false,
      historyMode: historySubject.mode,
      walletAddress: historySubject.session?.address,
      anonymousSessionId: anonymousSession?.id,
      sessionSyncCount: 0,
      anonymousAnalysisQuota: await readAnonymousAnalysisQuota(
        historySubject.subjectId,
        historySubject.mode,
      ),
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  try {
    const jobs = await storage.listJobs(limit, historySubject.subjectId);
    const sessionSyncCount =
      historySubject.mode === "wallet" && anonymousSession
        ? await storage.countJobs(anonymousSession.subjectId)
        : 0;

    return Response.json({
      jobs,
      storageEnabled: true,
      historyMode: historySubject.mode,
      walletAddress: historySubject.session?.address,
      anonymousSessionId: anonymousSession?.id,
      sessionSyncCount,
      anonymousAnalysisQuota: await readAnonymousAnalysisQuota(
        historySubject.subjectId,
        historySubject.mode,
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list analysis jobs.";

    return Response.json({ error: message, jobs: [], storageEnabled: true }, { status: 500 });
  }
}
