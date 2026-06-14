import { Redis } from "@upstash/redis";
import { getRedisClient } from "../../../lib/server-db";
import { readRedisEnabled } from "../../../lib/feature-config";
import type { AnalysisJobProgress, AnalysisJobStatus, AnalysisPhaseId } from "./progress";
import { applyPhaseCompleted, applyPhaseStarted, createInitialJobProgress } from "./progress";

const JOB_TTL_SECONDS = 60 * 60;
const REDIS_KEY_PREFIX = "wallet-map:analyze-job:";

export interface AnalysisJobRecord {
  jobId: string;
  subjectId?: string;
  status: AnalysisJobStatus;
  progress: AnalysisJobProgress;
  result?: unknown;
  error?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
}

interface AnalyzeJobGlobal {
  __walletMapAnalyzeJobs?: Map<string, AnalysisJobRecord>;
}

let upstashRedisClient: Redis | undefined;

function getUpstashRestConfig(): { url: string; token: string } | undefined {
  const url =
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.KV_REST_API_URL?.trim();
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ||
    process.env.KV_REST_API_TOKEN?.trim();

  if (!url || !token) {
    return undefined;
  }

  return { url, token };
}

function hasRedisBackend(): boolean {
  return Boolean(process.env.REDIS_URL?.trim() || getUpstashRestConfig());
}

function useMemoryStore(): boolean {
  return (
    process.env.ANALYZE_JOB_STORE === "memory" ||
    !readRedisEnabled() ||
    !hasRedisBackend()
  );
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

function getUpstashRedisClient(): Redis | undefined {
  const config = getUpstashRestConfig();

  if (!config) {
    return undefined;
  }

  if (!upstashRedisClient) {
    upstashRedisClient = new Redis(config);
  }

  return upstashRedisClient;
}

async function readRedisJob(jobId: string): Promise<AnalysisJobRecord | undefined> {
  const key = buildRedisKey(jobId);
  const upstash = getUpstashRedisClient();

  if (upstash) {
    const raw = await upstash.get<AnalysisJobRecord | string>(key).catch(() => null);

    if (!raw) {
      return undefined;
    }

    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as AnalysisJobRecord;
      } catch {
        return undefined;
      }
    }

    return raw;
  }

  const redis = await getRedisClient();
  if (!redis) {
    return undefined;
  }

  const raw = await redis.get(key).catch(() => null);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as AnalysisJobRecord;
  } catch {
    return undefined;
  }
}

async function writeRedisJob(record: AnalysisJobRecord): Promise<boolean> {
  const key = buildRedisKey(record.jobId);
  const value = JSON.stringify(record);
  const upstash = getUpstashRedisClient();

  if (upstash) {
    await upstash.set(key, value, { ex: JOB_TTL_SECONDS });
    return true;
  }

  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  await redis.set(key, value, { EX: JOB_TTL_SECONDS });
  return true;
}

async function deleteRedisJob(jobId: string): Promise<void> {
  const key = buildRedisKey(jobId);
  const upstash = getUpstashRedisClient();

  if (upstash) {
    await upstash.del(key).catch(() => undefined);
    return;
  }

  const redis = await getRedisClient();
  if (redis) {
    await redis.del(key).catch(() => undefined);
  }
}

async function readJob(jobId: string): Promise<AnalysisJobRecord | undefined> {
  const memoryJob = getMemoryJobMap().get(jobId);
  if (memoryJob) {
    return memoryJob;
  }

  if (useMemoryStore()) {
    return undefined;
  }

  const job = await readRedisJob(jobId);
  return job;
}

async function writeJob(record: AnalysisJobRecord): Promise<void> {
  record.updatedAt = new Date().toISOString();
  getMemoryJobMap().set(record.jobId, record);

  if (useMemoryStore()) {
    return;
  }

  const writePromise = writeRedisJob(record).catch(() => false);
  if (process.env.NODE_ENV !== "production") {
    void writePromise;
    return;
  }

  await writePromise;
}

export async function createAnalyzeJob(jobId: string, subjectId?: string): Promise<AnalysisJobRecord> {
  const now = new Date().toISOString();
  const record: AnalysisJobRecord = {
    jobId,
    subjectId,
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
    job.startedAt = job.startedAt ?? new Date().toISOString();
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

export async function deleteAnalyzeJob(jobId: string): Promise<void> {
  if (useMemoryStore()) {
    getMemoryJobMap().delete(jobId);
    return;
  }

  await deleteRedisJob(jobId);
  getMemoryJobMap().delete(jobId);
}

export function resetAnalyzeJobStoreForTests(): void {
  getMemoryJobMap().clear();
  upstashRedisClient = undefined;
}
