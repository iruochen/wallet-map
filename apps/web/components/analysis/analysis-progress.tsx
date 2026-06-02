import { CheckCircle2, CircleDashed, Database, Network, Route, Sparkles } from "lucide-react";

export interface AnalysisProgressStep {
  id: string;
  label: string;
  detail: string;
}

const defaultSteps: AnalysisProgressStep[] = [
  {
    id: "fetch",
    label: "拉取链上事件",
    detail: "读取 watched wallets 的 native、token、NFT 与 internal 记录",
  },
  {
    id: "labels",
    label: "识别地址标签",
    detail: "查询 Redis/PG 缓存，未命中时尝试 Chainbase live labels",
  },
  {
    id: "graph",
    label: "构建关系图谱",
    detail: "归一化钱包、合约、实体节点与证据边",
  },
  {
    id: "analysis",
    label: "运行分析器",
    detail: "计算直接转账、共享对手方和共同合约交互信号",
  },
];

const stepIcons = [Network, Database, Route, Sparkles] as const;

export function getAnalysisProgressValue(startedAt: number | null): number {
  if (!startedAt) {
    return 0;
  }

  const elapsed = Date.now() - startedAt;
  return Math.min(92, 8 + Math.round((1 - Math.exp(-elapsed / 11000)) * 84));
}

export function AnalysisProgress({
  progress,
  chainName,
  addressCount,
  steps = defaultSteps,
  variant = "panel",
}: {
  progress: number;
  chainName: string;
  addressCount: number;
  steps?: AnalysisProgressStep[];
  variant?: "panel" | "hero";
}) {
  const activeIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));

  return (
    <div className={`analysisProgressPanel analysisProgressPanel-${variant}`} role="status" aria-live="polite">
      <div className="analysisProgressHeader">
        <div>
          <span className="panelEyebrow">Running analysis</span>
          <strong>{chainName} · {addressCount} 地址</strong>
          {variant === "hero" ? (
            <p>正在读取链上事件、补全地址标签并构建证据图谱。结果完成后会自动切换到关系视图。</p>
          ) : null}
        </div>
        <span className="analysisProgressValue">{progress}%</span>
      </div>
      <div className="analysisProgressTrack" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
      <ol className="analysisProgressSteps">
        {steps.map((step, index) => {
          const Icon = stepIcons[index] ?? CircleDashed;
          const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "idle";

          return (
            <li key={step.id} className={`analysisProgressStep analysisProgressStep-${state}`}>
              <span className="analysisProgressIcon" aria-hidden="true">
                {state === "done" ? <CheckCircle2 size={15} strokeWidth={2.2} /> : <Icon size={15} strokeWidth={2.2} />}
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
