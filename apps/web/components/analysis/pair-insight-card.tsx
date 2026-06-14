"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { TranslateFn } from "./analysis-formatters";
import {
  formatConfidenceLabel,
  formatPairChainLabels,
  formatVerdictLabel,
  summarizeReasonLabels,
} from "./analysis-formatters";
import type { AnalysisResponse } from "./analysis-types";

type PairInsight = AnalysisResponse["summary"]["pairInsights"][number];

export function PairInsightCard({ pair, t }: { pair: PairInsight; t: TranslateFn }) {
  const [expanded, setExpanded] = useState(false);
  const uniqueReasons = Array.from(new Set(pair.reasons));
  const maxVisible = 4;
  const visibleReasons = expanded ? uniqueReasons : uniqueReasons.slice(0, maxVisible);
  const overflow = Math.max(0, uniqueReasons.length - maxVisible);
  const reasonSummary = summarizeReasonLabels(t, visibleReasons, visibleReasons.length);

  return (
    <div className="pairInsightCard">
      <div className="pairInsightHeader">
        <strong>{pair.labels.join(" ↔ ")}</strong>
        <span className={`verdictPill verdictPill-${pair.strength}`}>
          <Sparkles size={13} strokeWidth={2.1} />
          {formatVerdictLabel(t, pair.strength)}
        </span>
      </div>
      <div className="signalChipRow">
        {reasonSummary.labels.map((label) => (
          <span key={label} className="signalChip">
            {label}
          </span>
        ))}
        {overflow > 0 && !expanded ? (
          <button
            type="button"
            className="signalChip signalChipMuted signalChipButton"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
          >
            {t("analysis.summary.moreSignals", { count: overflow })}
          </button>
        ) : null}
        {expanded && overflow > 0 ? (
          <button
            type="button"
            className="signalChip signalChipMuted signalChipButton"
            aria-expanded={true}
            onClick={() => setExpanded(false)}
          >
            {t("analysis.summary.collapseSignals")}
          </button>
        ) : null}
      </div>
      <div className="pairInsightMeta">
        {pair.chainIds?.length ? (
          <span className="pairInsightChains">{formatPairChainLabels(pair.chainIds)}</span>
        ) : null}
        <span>{t("analysis.summary.signalCount", { count: pair.signalCount })}</span>
        <span>{formatConfidenceLabel(t, pair.confidence)}</span>
      </div>
    </div>
  );
}
