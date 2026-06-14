import { getSupportedAnalysisChain } from "../../../app/chains";
import type { I18nKey } from "../../i18n/i18n-provider";
import type { AnalysisResponse, GraphEdge } from "../types";

export type TranslateFn = (key: I18nKey, params?: Record<string, string | number>) => string;

export function formatVerdictLabel(
  t: TranslateFn,
  verdict: "none" | "weak" | "medium" | "strong",
): string {
  const keyMap: Record<typeof verdict, I18nKey> = {
    strong: "analysis.verdict.strong",
    medium: "analysis.verdict.medium",
    weak: "analysis.verdict.weak",
    none: "analysis.verdict.none",
  };

  return t(keyMap[verdict]);
}

export function formatConfidenceLabel(
  t: TranslateFn,
  confidence: "low" | "medium" | "high",
): string {
  const keyMap: Record<typeof confidence, I18nKey> = {
    high: "analysis.confidence.high",
    medium: "analysis.confidence.medium",
    low: "analysis.confidence.low",
  };

  return t(keyMap[confidence]);
}

export function formatSummaryHeadline(
  t: TranslateFn,
  verdict: AnalysisResponse["summary"]["verdict"],
  pairCount: number,
): string {
  const keyMap: Record<typeof verdict, I18nKey> = {
    strong: "analysis.summary.headline.strong",
    medium: "analysis.summary.headline.medium",
    weak: "analysis.summary.headline.weak",
    none: "analysis.summary.headline.none",
  };

  if (verdict === "none") {
    return t(keyMap.none);
  }

  return t(keyMap[verdict], { count: pairCount });
}

export function formatSummaryNarrative(
  t: TranslateFn,
  verdict: AnalysisResponse["summary"]["verdict"],
  pairInsights: AnalysisResponse["summary"]["pairInsights"],
): string {
  if (pairInsights.length === 0) {
    return t("analysis.summary.narrative.empty");
  }

  const lead = pairInsights[0]!;
  const pairLabel = lead.labels.join(" ↔ ");
  const reasons = lead.reasons.join(t("analysis.summary.reasonSeparator"));
  const keyMap: Record<Exclude<typeof verdict, "none">, I18nKey> = {
    strong: "analysis.summary.narrative.strong",
    medium: "analysis.summary.narrative.medium",
    weak: "analysis.summary.narrative.weak",
  };

  if (verdict === "none") {
    return t("analysis.summary.narrative.weak", { pair: pairLabel, reasons });
  }

  return t(keyMap[verdict], { pair: pairLabel, reasons });
}

export function describeFindingGroup(t: TranslateFn, title: string, count: number): string {
  if (title === "Direct transfer found") {
    return t("analysis.findingGroup.directTransfer", { count });
  }

  if (title === "Shared counterparty found") {
    return t("analysis.findingGroup.sharedCounterparty", { count });
  }

  if (title === "Same contract interaction found") {
    return t("analysis.findingGroup.sameContract", { count });
  }

  return t("analysis.findingGroup.default", { count });
}

export function describeEdgeGroup(t: TranslateFn, kind: GraphEdge["kind"], count: number): string {
  if (kind === "native_transfer") {
    return t("analysis.edgeGroup.nativeTransfer", { count });
  }

  if (kind === "token_transfer") {
    return t("analysis.edgeGroup.tokenTransfer", { count });
  }

  if (kind === "contract_interaction") {
    return t("analysis.edgeGroup.contractInteraction", { count });
  }

  return t("analysis.edgeGroup.default", { count });
}

export function formatSkippedChainSummary(t: TranslateFn, warnings: string[]): string {
  const names = warnings
    .map((warning) => /^([^:]+?)(?: skipped| analysis| is required)/.exec(warning)?.[1]?.trim())
    .map((name, index) => /live (.+?) analysis/.exec(warnings[index] ?? "")?.[1]?.trim() ?? name)
    .filter((name): name is string => Boolean(name));
  const uniqueNames = Array.from(new Set(names));

  if (uniqueNames.length === 0) {
    return t("analysis.skippedChain.summaryGeneric", { count: warnings.length });
  }

  return t("analysis.skippedChain.summaryNamed", { chains: uniqueNames.join(t("analysis.summary.reasonSeparator")) });
}

export function formatSkippedChainDetails(t: TranslateFn, warnings: string[]): string[] {
  const details = warnings.map((warning) => {
    const chainName = readWarningChainName(warning);
    const reason = formatProviderWarningReason(t, warning);

    return chainName ? `${chainName}: ${reason}` : reason;
  });

  return Array.from(new Set(details));
}

function readWarningChainName(warning: string): string | undefined {
  return (
    /^([^:]+?)(?: skipped| provider request failed| analysis| is required)/.exec(warning)?.[1]?.trim() ??
    /live (.+?) analysis/.exec(warning)?.[1]?.trim()
  );
}

function formatProviderWarningReason(t: TranslateFn, warning: string): string {
  if (/Free API access is not supported|api plan|does not support this chain/i.test(warning)) {
    return t("analysis.skippedChain.reason.unsupportedPlan");
  }

  if (/timed out|fetch failed|could not reach|TLS connection|reset/i.test(warning)) {
    return t("analysis.skippedChain.reason.network");
  }

  if (/API_KEY|is required|not configured/i.test(warning)) {
    return t("analysis.skippedChain.reason.missingConfig");
  }

  if (/rate limit|429/i.test(warning)) {
    return t("analysis.skippedChain.reason.rateLimit");
  }

  return t("analysis.skippedChain.reason.generic");
}

export function formatFindingRiskLabel(t: TranslateFn, value: string): string {
  if (value === "high") {
    return t("analysis.level.high");
  }
  if (value === "medium") {
    return t("analysis.level.medium");
  }
  if (value === "low") {
    return t("analysis.level.low");
  }
  return t("analysis.level.info");
}

export function formatFindingConfidenceText(t: TranslateFn, value: string): string {
  if (value === "high") {
    return t("analysis.level.high");
  }
  if (value === "medium") {
    return t("analysis.level.medium");
  }
  return t("analysis.level.low");
}

const findingTitleKeys: Record<string, I18nKey> = {
  "Direct transfer found": "analysis.signal.directTransfer",
  "Shared counterparty found": "analysis.signal.sharedCounterparty",
  "Same contract interaction found": "analysis.signal.sameContract",
  "Multi-hop transfer path found": "analysis.signal.multiHopPath",
  "Shared funding source found": "analysis.signal.sharedFunding",
  "Shared withdrawal destination found": "analysis.signal.sharedDestination",
  "Temporal pattern found": "analysis.signal.temporalPattern",
  "Bridge correlation found": "analysis.signal.bridgeCorrelation",
};

const edgeLegendKeys: Record<string, I18nKey> = {
  native_transfer: "graph.edgeLegend.nativeTransfer",
  token_transfer: "graph.edgeLegend.tokenTransfer",
  nft_transfer: "graph.edgeLegend.nftTransfer",
  contract_interaction: "graph.edgeLegend.contractInteraction",
  shared_counterparty: "graph.edgeLegend.sharedCounterparty",
  temporal_similarity: "graph.edgeLegend.temporalSimilarity",
  bridge_route: "graph.edgeLegend.bridgeRoute",
};

export function formatFindingTitle(t: TranslateFn, title: string): string {
  const key = findingTitleKeys[title];
  return key ? t(key) : title;
}

export function formatEdgeKindLegendLabel(t: TranslateFn, kind: string): string {
  const key = edgeLegendKeys[kind];
  return key ? t(key) : kind;
}

export function summarizeReasonLabels(
  t: TranslateFn,
  reasons: string[],
  max = 4,
): { labels: string[]; overflow: number } {
  const unique = Array.from(new Set(reasons));
  const labels = unique.slice(0, max).map((reason) => formatFindingTitle(t, reason));

  return {
    labels,
    overflow: Math.max(0, unique.length - max),
  };
}

export function formatPairChainLabels(chainIds: number[]): string {
  if (chainIds.length === 0) {
    return "";
  }

  return chainIds
    .map((chainId) => getSupportedAnalysisChain(chainId)?.shortName ?? String(chainId))
    .join(" · ");
}

const eventTypeKeys: Record<string, I18nKey> = {
  native_transfer: "analysis.event.nativeTransfer",
  token_transfer: "analysis.event.tokenTransfer",
  nft_transfer: "analysis.event.nftTransfer",
  contract_call: "analysis.event.contractCall",
  bridge: "analysis.event.bridge",
  dex_swap: "analysis.event.dexSwap",
};

export function formatEventTypeLabelI18n(t: TranslateFn, type: string | undefined): string {
  if (!type) {
    return t("analysis.event.unknown");
  }

  const key = eventTypeKeys[type];
  return key ? t(key) : type;
}

export function formatEdgeKindLabelI18n(t: TranslateFn, kind: string | undefined): string {
  if (!kind) {
    return t("analysis.edge.unknown");
  }

  const key = edgeLegendKeys[kind];
  return key ? t(key) : kind;
}
