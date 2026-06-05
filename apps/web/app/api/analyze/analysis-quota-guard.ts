import { getAnalysisStorage } from "./analysis-storage";
import {
  buildAnonymousQuota,
  formatAnonymousQuotaError,
  readAnonymousAnalysisLimit,
} from "../auth/analysis-quota";

export async function assertAnonymousAnalysisAllowed(subjectId: string): Promise<void> {
  const limit = readAnonymousAnalysisLimit();

  if (limit === null) {
    return;
  }

  const storage = await getAnalysisStorage();

  if (!storage) {
    return;
  }

  const used = await storage.countJobs(subjectId);

  if (used >= limit) {
    throw new Error(formatAnonymousQuotaError(limit));
  }
}

export async function readAnonymousAnalysisQuota(
  subjectId: string,
  mode: "wallet" | "session",
): Promise<ReturnType<typeof buildAnonymousQuota>> {
  const limit = readAnonymousAnalysisLimit();

  if (limit === null || mode !== "session") {
    return null;
  }

  const storage = await getAnalysisStorage();

  if (!storage) {
    return buildAnonymousQuota(0, limit);
  }

  const used = await storage.countJobs(subjectId);
  return buildAnonymousQuota(used, limit);
}
