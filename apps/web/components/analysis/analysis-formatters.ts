import type { GraphEdge } from "./analysis-types";

export function formatVerdictLabel(verdict: "none" | "weak" | "medium" | "strong"): string {
  switch (verdict) {
    case "strong":
      return "强关联";
    case "medium":
      return "中关联";
    case "weak":
      return "弱关联";
    default:
      return "无结论";
  }
}

export function formatConfidenceLabel(confidence: "low" | "medium" | "high"): string {
  if (confidence === "high") {
    return "高置信度";
  }

  if (confidence === "medium") {
    return "中置信度";
  }

  return "低置信度";
}

export function describeFindingGroup(title: string, count: number): string {
  if (title === "Direct transfer found") {
    return `命中了 ${count} 笔直接转账证据`;
  }

  if (title === "Shared counterparty found") {
    return `命中了 ${count} 组共享对手方线索`;
  }

  if (title === "Same contract interaction found") {
    return `命中了 ${count} 组共同合约交互`;
  }

  return `命中了 ${count} 条关联信号`;
}

export function describeEdgeGroup(kind: GraphEdge["kind"], count: number): string {
  if (kind === "native_transfer") {
    return `${count} 条原生币关联边`;
  }

  if (kind === "token_transfer") {
    return `${count} 条代币关联边`;
  }

  if (kind === "contract_interaction") {
    return `${count} 条合约交互关联边`;
  }

  return `${count} 条关联边`;
}

export function formatSkippedChainSummary(warnings: string[]): string {
  const names = warnings
    .map((warning) => /^([^:]+?)(?: skipped| analysis| is required)/.exec(warning)?.[1]?.trim())
    .map((name, index) => /live (.+?) analysis/.exec(warnings[index] ?? "")?.[1]?.trim() ?? name)
    .filter((name): name is string => Boolean(name));
  const uniqueNames = Array.from(new Set(names));

  if (uniqueNames.length === 0) {
    return `${warnings.length} 条链路未完成，可展开查看详情。`;
  }

  return `跳过链：${uniqueNames.join("、")}`;
}

export function formatFindingRiskLabel(value: string): string {
  if (value === "high") {
    return "高";
  }
  if (value === "medium") {
    return "中";
  }
  if (value === "low") {
    return "低";
  }
  return "信息";
}

export function formatFindingConfidenceText(value: string): string {
  if (value === "high") {
    return "高";
  }
  if (value === "medium") {
    return "中";
  }
  return "低";
}
