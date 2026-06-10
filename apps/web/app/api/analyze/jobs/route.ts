import { readAnonymousAnalysisQuota } from "../analysis-quota-guard";
import { getAnalysisStorage } from "../analysis-storage";
import { getCurrentHistorySubject, readAnonymousSession } from "../../auth/session";
import type { AnalysisJobStatusFilter } from "@wallet-map/storage";

export async function GET(request: Request): Promise<Response> {
  const storage = await getAnalysisStorage();
  const historySubject = await getCurrentHistorySubject();
  const anonymousSession = await readAnonymousSession();

  if (!storage) {
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    return Response.json({
      jobs: [],
      total: 0,
      limit,
      offset,
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
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const status = readHistoryStatusFilter(url.searchParams.get("status"));
  const query = url.searchParams.get("query")?.trim() || undefined;

  try {
    const listInput = {
      limit,
      offset,
      subjectId: historySubject.subjectId,
      status,
      query,
    };
    const [jobs, total] = await Promise.all([
      storage.listJobs(listInput),
      storage.countJobs(listInput),
    ]);
    const sessionSyncCount =
      historySubject.mode === "wallet" && anonymousSession
        ? await storage.countJobs({ subjectId: anonymousSession.subjectId })
        : 0;

    return Response.json({
      jobs,
      total,
      limit,
      offset,
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

function readHistoryStatusFilter(value: string | null): AnalysisJobStatusFilter {
  if (value === "pending" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }

  return "all";
}
