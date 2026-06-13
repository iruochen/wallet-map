"use client";

import { CheckCircle2, CircleDashed, Clock3, Database, LoaderCircle, Network, Route, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalysisJobProgress, AnalysisPhaseId } from "../../app/api/analyze/progress";
import { getProgressPercent, resolveStepState } from "../../app/api/analyze/progress";
import { useI18n } from "../i18n/i18n-provider";

export interface AnalysisProgressStep {
  id: AnalysisPhaseId;
  label: string;
  detail: string;
}

const stepIcons = [Network, Route, Database, Sparkles] as const;

export function AnalysisProgress({
  progress,
  chainName,
  addressCount,
  startedAt,
  steps,
  variant = "panel",
}: {
  progress: AnalysisJobProgress | null;
  chainName: string;
  addressCount: number;
  startedAt?: number | null;
  steps?: AnalysisProgressStep[];
  variant?: "panel" | "hero";
}) {
  const { t } = useI18n();
  const resolvedSteps = steps ?? [
    {
      id: "fetch" as const,
      label: t("progress.step.fetch.label"),
      detail: t("progress.step.fetch.detail"),
    },
    {
      id: "graph" as const,
      label: t("progress.step.graph.label"),
      detail: t("progress.step.graph.detail"),
    },
    {
      id: "labels" as const,
      label: t("progress.step.labels.label"),
      detail: t("progress.step.labels.detail"),
    },
    {
      id: "analysis" as const,
      label: t("progress.step.analysis.label"),
      detail: t("progress.step.analysis.detail"),
    },
  ];
  const percent = getProgressPercent(progress);
  const [now, setNow] = useState(() => Date.now());
  const activeStep = resolvedSteps.find((step) => step.id === progress?.phase);
  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className={`analysisProgressPanel analysisProgressPanel-${variant}`} role="status" aria-live="polite">
      <div className="analysisProgressHeader">
        <div>
          <span className="panelEyebrow">{t("progress.eyebrow")}</span>
          <strong>{chainName} · {t("progress.addressCount", { count: addressCount })}</strong>
          {variant === "hero" ? (
            <p>{t("progress.heroBody")}</p>
          ) : null}
          <small className="analysisProgressHint">{t("progress.hint")}</small>
        </div>
        <div className="analysisProgressStatus">
          <span className="analysisProgressValue">
            <LoaderCircle size={14} strokeWidth={2.4} className="analysisProgressSpinner" aria-hidden="true" />
            {percent}%
          </span>
          <span className="analysisProgressTime">
            <Clock3 size={13} strokeWidth={2.2} aria-hidden="true" />
            {startedAt ? t("progress.elapsed", { time: formatElapsedTime(elapsedMs) }) : t("progress.ready")}
          </span>
          <span className="analysisProgressPhase">
            {activeStep ? activeStep.label : t("progress.queued")}
          </span>
        </div>
      </div>
      <div
        className={`analysisProgressTrack ${percent > 0 && percent < 100 ? "" : "analysisProgressTrack-indeterminate"}`}
        aria-hidden="true"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <ol className="analysisProgressSteps">
        {resolvedSteps.map((step, index) => {
          const Icon = stepIcons[index] ?? CircleDashed;
          const state = resolveStepState(step.id, progress);

          return (
            <li key={step.id} className={`analysisProgressStep analysisProgressStep-${state}`}>
              <span className="analysisProgressIcon" aria-hidden="true">
                {state === "done" ? (
                  <CheckCircle2 size={15} strokeWidth={2.2} />
                ) : (
                  <Icon size={15} strokeWidth={2.2} />
                )}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function LoadingResult() {
  return (
    <div className="loadingStack" aria-label="Analysis job running">
      <div className="skeletonBlock skeletonTall" />
      <div className="skeletonGrid">
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
        <div className="skeletonBlock" />
      </div>
      <div className="skeletonLine" />
    </div>
  );
}

export function LoadingList() {
  return (
    <div className="loadingStack">
      <div className="skeletonBlock" />
      <div className="skeletonBlock" />
      <div className="skeletonBlock" />
    </div>
  );
}
