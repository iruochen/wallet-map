import { getRedisClient } from "../../../lib/server-db";
import type { AnalysisJobProgress, AnalysisJobStatus, AnalysisPhaseId } from "./progress";
import { applyPhaseCompleted, applyPhaseStarted, createInitialJobProgress } from "./progress";

const JOB_TTL_SECONDS = 60 * 60;
const REDIS_KEY_PREFIX = "wallet-map:analyze-job:";

export interface AnalysisJobRecord {
  jobId: string;
  status: AnalysisJobStatus;
  progress: AnalysisJobProgress;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

interface AnalyzeJobGlobal {
  __walletMapAnalyzeJobs?: Map<string, AnalysisJobRecord>;
}

function useMemoryStore(): boolean {
  return process.env.ANALYZE_JOB_STORE === "memory" || !process.env.REDIS_URL?.trim();
}

function getMemoryJobMap(): Map<string, AnalysisJobRecord> {
  const globalStore = globalThis as AnalyzeJobGlobal;

  if (!globalStore.__walletMapAnalyzeJobs) {
    globalStore.__walletMapAnalyzeJobs = new Map();
  }

  return globalStore.__walletMapAnalyzeJobs;
}

function buildRedisKey(jobId: string): string {
  return `${REDIS_KEY_PREFIX}${jobId}`;
}

async function readJob(jobId: string): Promise<AnalysisJobRecord | undefined> {
  if (useMemoryStore()) {
    return getMemoryJobMap().get(jobId);
  }

  const redis = await getRedisClient();
  if (!redis) {
    return getMemoryJobMap().get(jobId);
  }

  const raw = await redis.get(buildRedisKey(jobId)).catch(() => null);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as AnalysisJobRecord;
  } catch {
    return undefined;
  }
}

async function writeJob(record: AnalysisJobRecord): Promise<void> {
  record.updatedAt = new Date().toISOString();

  if (useMemoryStore()) {
    getMemoryJobMap().set(record.jobId, record);
    return;
  }

  const redis = await getRedisClient();
  if (!redis) {
    getMemoryJobMap().set(record.jobId, record);
    return;
  }

  await redis
    .set(buildRedisKey(record.jobId), JSON.stringify(record), { EX: JOB_TTL_SECONDS })
    .catch(() => {
      getMemoryJobMap().set(record.jobId, record);
    });
}

export async function createAnalyzeJob(jobId: string): Promise<AnalysisJobRecord> {
  const now = new Date().toISOString();
  const record: AnalysisJobRecord = {
    jobId,
    status: "pending",
    progress: createInitialJobProgress(),
    createdAt: now,
    updatedAt: now,
  };

  await writeJob(record);
  return record;
}

export async function getAnalyzeJob(jobId: string): Promise<AnalysisJobRecord | undefined> {
  return readJob(jobId);
}

async function updateJob(
  jobId: string,
  updater: (job: AnalysisJobRecord) => void,
): Promise<AnalysisJobRecord | undefined> {
  const job = await readJob(jobId);
  if (!job) {
    return undefined;
  }

  updater(job);
  await writeJob(job);
  return job;
}

export async function markAnalyzeJobRunning(jobId: string): Promise<void> {
  await updateJob(jobId, (job) => {
    job.status = "running";
  });
}

export async function markAnalyzeJobPhaseStarted(jobId: string, phase: AnalysisPhaseId): Promise<void> {
  await updateJob(jobId, (job) => {
    job.progress = applyPhaseStarted(job.progress, phase);
  });
}

export async function markAnalyzeJobPhaseCompleted(jobId: string, phase: AnalysisPhaseId): Promise<void> {
  await updateJob(jobId, (job) => {
    job.progress = applyPhaseCompleted(job.progress, phase);
  });
}

export async function markAnalyzeJobCompleted(jobId: string, result: unknown): Promise<void> {
  await updateJob(jobId, (job) => {
    job.status = "completed";
    job.result = result;
    job.progress = {
      phase: null,
      completedPhases: ["fetch", "graph", "labels", "analysis"],
    };
  });
}

export async function markAnalyzeJobFailed(jobId: string, error: string): Promise<void> {
  await updateJob(jobId, (job) => {
    job.status = "failed";
    job.error = error;
  });
}

export function resetAnalyzeJobStoreForTests(): void {
  getMemoryJobMap().clear();
}
