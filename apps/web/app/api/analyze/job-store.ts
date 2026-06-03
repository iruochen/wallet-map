import type { AnalysisJobProgress, AnalysisJobStatus, AnalysisPhaseId } from "./progress";
import { applyPhaseCompleted, applyPhaseStarted, createInitialJobProgress } from "./progress";

const JOB_TTL_MS = 60 * 60 * 1000;

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

function getJobMap(): Map<string, AnalysisJobRecord> {
  const globalStore = globalThis as AnalyzeJobGlobal;

  if (!globalStore.__walletMapAnalyzeJobs) {
    globalStore.__walletMapAnalyzeJobs = new Map();
  }

  return globalStore.__walletMapAnalyzeJobs;
}

function pruneExpiredJobs(now = Date.now()): void {
  const jobs = getJobMap();

  for (const [jobId, job] of jobs.entries()) {
    if (now - Date.parse(job.updatedAt) > JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
}

export function createAnalyzeJob(jobId: string): AnalysisJobRecord {
  pruneExpiredJobs();

  const now = new Date().toISOString();
  const record: AnalysisJobRecord = {
    jobId,
    status: "pending",
    progress: createInitialJobProgress(),
    createdAt: now,
    updatedAt: now,
  };

  getJobMap().set(jobId, record);
  return record;
}

export function getAnalyzeJob(jobId: string): AnalysisJobRecord | undefined {
  return getJobMap().get(jobId);
}

export function markAnalyzeJobRunning(jobId: string): void {
  const job = getJobMap().get(jobId);
  if (!job) {
    return;
  }

  job.status = "running";
  job.updatedAt = new Date().toISOString();
}

export function markAnalyzeJobPhaseStarted(jobId: string, phase: AnalysisPhaseId): void {
  const job = getJobMap().get(jobId);
  if (!job) {
    return;
  }

  job.progress = applyPhaseStarted(job.progress, phase);
  job.updatedAt = new Date().toISOString();
}

export function markAnalyzeJobPhaseCompleted(jobId: string, phase: AnalysisPhaseId): void {
  const job = getJobMap().get(jobId);
  if (!job) {
    return;
  }

  job.progress = applyPhaseCompleted(job.progress, phase);
  job.updatedAt = new Date().toISOString();
}

export function markAnalyzeJobCompleted(jobId: string, result: unknown): void {
  const job = getJobMap().get(jobId);
  if (!job) {
    return;
  }

  job.status = "completed";
  job.result = result;
  job.progress = {
    phase: null,
    completedPhases: ["fetch", "graph", "labels", "analysis"],
  };
  job.updatedAt = new Date().toISOString();
}

export function markAnalyzeJobFailed(jobId: string, error: string): void {
  const job = getJobMap().get(jobId);
  if (!job) {
    return;
  }

  job.status = "failed";
  job.error = error;
  job.updatedAt = new Date().toISOString();
}

export function resetAnalyzeJobStoreForTests(): void {
  getJobMap().clear();
}
