export type AnalysisPhaseId = "fetch" | "graph" | "labels" | "analysis";

export const ANALYSIS_PHASE_ORDER: readonly AnalysisPhaseId[] = [
  "fetch",
  "graph",
  "labels",
  "analysis",
] as const;

export type AnalysisJobStatus = "pending" | "running" | "completed" | "failed";

export interface AnalysisJobProgress {
  phase: AnalysisPhaseId | null;
  completedPhases: AnalysisPhaseId[];
}

export function createInitialJobProgress(): AnalysisJobProgress {
  return {
    phase: null,
    completedPhases: [],
  };
}

export function applyPhaseStarted(
  progress: AnalysisJobProgress,
  phase: AnalysisPhaseId,
): AnalysisJobProgress {
  return {
    phase,
    completedPhases: progress.completedPhases,
  };
}

export function applyPhaseCompleted(
  progress: AnalysisJobProgress,
  phase: AnalysisPhaseId,
): AnalysisJobProgress {
  const completedPhases = progress.completedPhases.includes(phase)
    ? progress.completedPhases
    : [...progress.completedPhases, phase];

  const nextPhaseIndex = ANALYSIS_PHASE_ORDER.indexOf(phase) + 1;
  const nextPhase = ANALYSIS_PHASE_ORDER[nextPhaseIndex] ?? null;

  return {
    phase: nextPhase,
    completedPhases,
  };
}

export function getProgressPercent(progress: AnalysisJobProgress | null | undefined): number {
  if (!progress) {
    return 0;
  }

  if (progress.completedPhases.length >= ANALYSIS_PHASE_ORDER.length) {
    return 100;
  }

  const completedWeight = progress.completedPhases.length / ANALYSIS_PHASE_ORDER.length;
  const activeWeight = progress.phase ? 0.5 / ANALYSIS_PHASE_ORDER.length : 0;

  return Math.min(99, Math.round((completedWeight + activeWeight) * 100));
}

export function resolveStepState(
  stepId: AnalysisPhaseId,
  progress: AnalysisJobProgress | null | undefined,
): "done" | "active" | "idle" {
  if (!progress) {
    return "idle";
  }

  if (progress.completedPhases.includes(stepId)) {
    return "done";
  }

  if (progress.phase === stepId) {
    return "active";
  }

  return "idle";
}
