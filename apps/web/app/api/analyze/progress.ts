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
  const phaseIndex = ANALYSIS_PHASE_ORDER.indexOf(phase);
  const completedPhases = [...progress.completedPhases];

  // Fast phases may finish between polls; backfill earlier phases as completed.
  for (let index = 0; index < phaseIndex; index += 1) {
    const priorPhase = ANALYSIS_PHASE_ORDER[index]!;
    if (!completedPhases.includes(priorPhase)) {
      completedPhases.push(priorPhase);
    }
  }

  return {
    phase,
    completedPhases,
  };
}

export function applyPhaseCompleted(
  progress: AnalysisJobProgress,
  phase: AnalysisPhaseId,
): AnalysisJobProgress {
  const phaseIndex = ANALYSIS_PHASE_ORDER.indexOf(phase);
  const completedPhases = [...progress.completedPhases];

  for (let index = 0; index <= phaseIndex; index += 1) {
    const completedPhase = ANALYSIS_PHASE_ORDER[index]!;
    if (!completedPhases.includes(completedPhase)) {
      completedPhases.push(completedPhase);
    }
  }

  const nextPhaseIndex = phaseIndex + 1;
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
