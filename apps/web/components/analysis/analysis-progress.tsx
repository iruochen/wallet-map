"use client";

import { CheckCircle2, CircleDashed, Clock3, Database, LoaderCircle, Network, Route, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { AnalysisJobProgress, AnalysisPhaseId } from "../../app/api/analyze/progress";
import { getProgressPercent, resolveStepState } from "../../app/api/analyze/progress";

export interface AnalysisProgressStep {
  id: AnalysisPhaseId;
  label: string;
  detail: string;
}

export const defaultAnalysisSteps: AnalysisProgressStep[] = [
  {
    id: "fetch",
    label: "拉取链上事件",
    detail: "读取 watched wallets 的 native、token、NFT 与 internal 记录",
  },
  {
    id: "graph",
    label: "构建关系图谱",
    detail: "归一化钱包、合约、实体节点与证据边",
  },
  {
    id: "labels",
    label: "识别地址标签",
    detail: "查询 Redis/PG 缓存，未命中时尝试 Chainbase live labels",
  },
  {
    id: "analysis",
    label: "运行分析器",
    detail: "计算直接转账、共享对手方和共同合约交互信号",
  },
];

const stepIcons = [Network, Route, Database, Sparkles] as const;

export function AnalysisProgress({
  progress,
  chainName,
  addressCount,
  startedAt,
  steps = defaultAnalysisSteps,
  variant = "panel",
}: {
  progress: AnalysisJobProgress | null;
  chainName: string;
  addressCount: number;
  startedAt?: number | null;
  steps?: AnalysisProgressStep[];
  variant?: "panel" | "hero";
}) {
  const percent = getProgressPercent(progress);
  const [now, setNow] = useState(() => Date.now());
  const activeStep = steps.find((step) => step.id === progress?.phase);
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
          <span className="panelEyebrow">Running analysis</span>
          <strong>{chainName} · {addressCount} 地址</strong>
          {variant === "hero" ? (
            <p>正在读取链上事件、补全地址标签并构建证据图谱。结果完成后会自动切换到关系视图。</p>
          ) : null}
          <small className="analysisProgressHint">进度由后端分阶段推送，已完成步骤会标记为完成。</small>
        </div>
        <div className="analysisProgressStatus">
          <span className="analysisProgressValue">
            <LoaderCircle size={14} strokeWidth={2.4} className="analysisProgressSpinner" aria-hidden="true" />
            {percent}%
          </span>
          <span className="analysisProgressTime">
            <Clock3 size={13} strokeWidth={2.2} aria-hidden="true" />
            {startedAt ? `已运行 ${formatElapsedTime(elapsedMs)}` : "准备中"}
          </span>
          <span className="analysisProgressPhase">
            {activeStep ? activeStep.label : "排队中"}
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
        {steps.map((step, index) => {
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
    <div className="loadingStack" aria-label="分析任务运行中">
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
