import type { AnalysisResponse } from "../analysis/types";
import type { HistoryJobItem } from "./history-types";

const sessionHistoryStorageKey = "wallet-map:session-analysis-history";
const sessionHistoryLimit = 50;

export function saveSessionHistoryJob(
  jobId: string,
  result: AnalysisResponse,
  timestamps: { createdAt?: string; startedAt?: string } = {},
): void {
  if (typeof window === "undefined") {
    return;
  }

  const completedAt = result.meta.fetchedAt;
  const item: HistoryJobItem = {
    id: jobId,
    status: "completed",
    chainName: result.meta.chainName,
    sourceLabel: result.sourceLabel ?? result.source,
    dataMode: result.meta.resolvedMode,
    watchedAddressCount: result.meta.watchedAddressCount,
    eventCount: result.meta.eventCount,
    score: result.score,
    createdAt: timestamps.createdAt ?? completedAt,
    startedAt: timestamps.startedAt,
    completedAt,
  };

  try {
    const current = readSessionHistoryJobs();
    const next = [item, ...current.filter((job) => job.id !== jobId)].slice(0, sessionHistoryLimit);
    window.sessionStorage.setItem(sessionHistoryStorageKey, JSON.stringify(next));
  } catch {
    // Browser storage can be unavailable; analysis itself should not fail.
  }
}

export function readSessionHistoryJobs(): HistoryJobItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(sessionHistoryStorageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isHistoryJobItem).slice(0, sessionHistoryLimit);
  } catch {
    return [];
  }
}

function isHistoryJobItem(value: unknown): value is HistoryJobItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<HistoryJobItem>;
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    (item.status === "pending" ||
      item.status === "running" ||
      item.status === "completed" ||
      item.status === "failed")
  );
}
