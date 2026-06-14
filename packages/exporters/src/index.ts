import type { Finding, RelationshipGraph, RelationshipScore } from "@wallet-map/core";
import { renderPdfReportBlob } from "./pdf-report";

export interface ExportOptions {
  redactAddresses?: boolean;
}

export interface ReportEvidenceEvent {
  type?: string;
  chainId?: number;
  txHash?: string;
  blockNumber?: number;
  timestamp?: string;
  from?: string;
  to?: string;
  contract?: string;
  methodId?: string;
  amount?: string;
  asset?: {
    kind?: string;
    symbol?: string;
    contract?: string;
    decimals?: number;
    tokenId?: string;
  };
}

export interface ReportEvidenceRef {
  eventId: string;
  txHash?: string;
  summary: string;
  event?: ReportEvidenceEvent;
}

export interface ReportFinding {
  id: string;
  analyzerId: string;
  title: string;
  description: string;
  severity: Finding["severity"];
  confidence: Finding["confidence"];
  scoreImpact: number;
  evidence: ReportEvidenceRef[];
  evidenceTotal?: number;
  evidenceTruncated?: boolean;
}

export interface AnalysisReport {
  title: string;
  generatedAt: string;
  scope?: string;
  sourceLabel?: string;
  graph: RelationshipGraph;
  findings: ReportFinding[];
  score: RelationshipScore;
  summary?: {
    verdict?: "none" | "weak" | "medium" | "strong" | string;
    headline?: string;
    narrative?: string;
    pairInsights?: Array<{
      labels: string[];
      strength: string;
      score: number;
      confidence: string;
      signalCount: number;
      reasons: string[];
      chainIds?: number[];
    }>;
    signalHighlights?: Array<{
      analyzerId: string;
      title: string;
      count: number;
    }>;
  };
  metrics?: {
    watchedAddressCount?: number;
    eventCount?: number;
    walletCount?: number;
    contractCount?: number;
    edgeCount?: number;
  };
  meta?: {
    reportId?: string;
    chainName?: string;
    chainId?: number;
    dataProvider?: string;
    resolvedMode?: "fixture" | "live";
    fallbackReason?: string;
    warnings?: string[];
    fetchedAt?: string;
    graphNodesTruncated?: boolean;
    graphEdgesTruncated?: boolean;
  };
}

export interface Exporter {
  id: string;
  name: string;
  export(report: AnalysisReport, options?: ExportOptions): Promise<string>;
}

export class JsonExporter implements Exporter {
  id = "json";
  name = "JSON Exporter";

  async export(report: AnalysisReport, options: ExportOptions = {}): Promise<string> {
    return JSON.stringify(
      {
        schemaVersion: "1.1",
        ...redactReport(report, options),
      },
      null,
      2,
    );
  }
}

export class MarkdownExporter implements Exporter {
  id = "markdown";
  name = "Markdown Exporter";

  async export(report: AnalysisReport, options: ExportOptions = {}): Promise<string> {
    const safeReport = redactReport(report, options);
    const signalGroups = summarizeFindings(safeReport.findings);
    const reportId = safeReport.meta?.reportId ?? "WM-UNKNOWN";

    return [
      `# ${safeReport.title}`,
      "",
      "> Wallet Map 将链上事件转化为可复核的关联信号。本报告供分析人员审阅，不构成最终归属认定。",
      "",
      "## 报告信息",
      "",
      "| 字段 | 内容 |",
      "| --- | --- |",
      `| 报告编号 | \`${reportId}\` |`,
      `| 生成时间 | ${safeReport.generatedAt} |`,
      `| 分析范围 | ${safeReport.scope ?? "未知"} |`,
      `| 数据来源 | ${safeReport.sourceLabel ?? "未知"} |`,
      `| 数据模式 | ${safeReport.meta?.resolvedMode === "live" ? "实时数据" : safeReport.meta?.resolvedMode === "fixture" ? "本地样本" : "未知"} |`,
      safeReport.meta?.dataProvider ? `| 数据 Provider | ${safeReport.meta.dataProvider} |` : undefined,
      "",
      "---",
      "",
      "## 一、结论摘要",
      "",
      formatVerdictTable(safeReport),
      "",
      "### 核心结论",
      "",
      safeReport.summary?.headline ?? "当前分析未形成明确结论。",
      "",
      safeReport.summary?.narrative ? "### 分析叙述\n\n" + safeReport.summary.narrative : undefined,
      "",
      "---",
      "",
      "## 二、核心指标",
      "",
      formatMetricsTable(safeReport),
      "",
      "### 多维评分",
      "",
      formatScoreDimensionsTable(safeReport),
      "",
      "---",
      "",
      "## 三、信号概览",
      "",
      formatSignalHighlightsTable(safeReport.summary?.signalHighlights ?? [], signalGroups),
      "",
      "---",
      "",
      "## 四、钱包对关联洞察",
      "",
      formatPairInsightsTable(safeReport.summary?.pairInsights ?? []),
      "",
      "---",
      "",
      "## 五、关系图谱概览",
      "",
      formatMermaidOverview(safeReport),
      "",
      formatGraphTruncationNote(safeReport),
      "",
      "---",
      "",
      "## 六、详细发现",
      "",
      formatGroupedFindings(safeReport.findings),
      "",
      "---",
      "",
      "## 七、复核要点",
      "",
      formatReviewerSection(safeReport),
      "",
      safeReport.meta?.fallbackReason || safeReport.meta?.warnings?.length
        ? "## 八、运行说明\n\n" + formatRunNotes(safeReport)
        : undefined,
      "",
      "## 方法说明与免责声明",
      "",
      "- **方法说明**：报告基于 watched wallets 的链上事件构建关系图谱，并通过直接转账、共享对手方、共同合约交互等分析器生成信号。",
      "- **使用边界**：结果为分析信号，需结合时间窗口、交易所/桥接/合约中介路径等上下文复核，不可单独作为归属或合规结论。",
      "- **证据范围**：每条发现附带可回溯的交易证据；若标注「证据已截断」，表示 UI/报告仅展示部分样本。",
      "",
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n");
  }
}

export class PdfReportExporter {
  id = "pdf";
  name = "PDF Report Exporter";

  async export(report: AnalysisReport, options: ExportOptions = {}): Promise<Blob> {
    const safeReport = redactReport(report, options);
    return renderPdfReportBlob(safeReport);
  }
}

function formatVerdictTable(report: AnalysisReport): string {
  const verdict = formatVerdict(report.summary?.verdict);

  return [
    "| 维度 | 结果 |",
    "| --- | --- |",
    `| **关联判定** | ${verdict} |`,
    `| **关系评分** | ${report.score.score} / 100 |`,
    `| **整体置信度** | ${formatConfidenceZh(report.score.confidence)} |`,
    `| **信号条数** | ${report.findings.length} |`,
  ].join("\n");
}

function formatMetricsTable(report: AnalysisReport): string {
  const metrics = report.metrics;
  const walletCount = metrics?.walletCount ?? countNodesByKind(report.graph, "wallet");
  const contractCount = metrics?.contractCount ?? countNodesByKind(report.graph, "contract");
  const edgeCount = metrics?.edgeCount ?? report.graph.edges.length;

  return [
    "| 指标 | 数值 | 说明 |",
    "| --- | ---: | --- |",
    `| 监控地址数 | ${metrics?.watchedAddressCount ?? "—"} | 本次提交分析的 watched wallets |`,
    `| 链上事件数 | ${metrics?.eventCount ?? "—"} | 纳入分析的事件总量 |`,
    `| 钱包节点 | ${walletCount} | 关系图谱中的钱包节点 |`,
    `| 合约节点 | ${contractCount} | 关系图谱中的合约节点 |`,
    `| 证据边 | ${edgeCount} | 图谱中的关联边 |`,
  ].join("\n");
}

function formatScoreDimensionsTable(report: AnalysisReport): string {
  const dimensions = report.score.dimensions;

  return [
    "| 维度 | 评分 | 说明 |",
    "| --- | ---: | --- |",
    `| Funding Link | ${dimensions.funding} / 100 | 直接转账、共同资金来源、多跳资金路径 |`,
    `| Destination Link | ${dimensions.destination} / 100 | 共同下游、交易所/桥/聚合器去向、桥路径 |`,
    `| Contract Link | ${dimensions.contract} / 100 | 共同合约、共同方法或合约交互序列 |`,
    `| Time Link | ${dimensions.temporal} / 100 | 时间窗口重合或相似行为节奏 |`,
    `| Asset Link | ${dimensions.asset} / 100 | Token、NFT、SBT、POAP 或其他资产重合 |`,
  ].join("\n");
}

function formatSignalHighlightsTable(
  highlights: NonNullable<AnalysisReport["summary"]>["signalHighlights"],
  signalGroups: SignalGroup[],
): string {
  if (highlights && highlights.length > 0) {
    return [
      "| 分析器 | 信号类型 | 命中次数 |",
      "| --- | --- | ---: |",
      ...highlights.map(
        (item) => `| \`${item.analyzerId}\` | ${item.title} | ${item.count} |`,
      ),
    ].join("\n");
  }

  if (signalGroups.length === 0) {
    return "本次分析未生成可展示的信号。";
  }

  return [
    "| 信号类型 | 命中次数 | 风险等级 | 置信度 | 累计影响 |",
    "| --- | ---: | --- | --- | ---: |",
    ...signalGroups.map(
      (group) =>
        `| ${group.title} | ${group.count} | ${formatSeverityZh(group.severity)} | ${formatConfidenceZh(group.confidence)} | ${group.scoreImpact} |`,
    ),
  ].join("\n");
}

function formatPairInsightsTable(
  pairs: NonNullable<NonNullable<AnalysisReport["summary"]>["pairInsights"]>,
): string {
  if (pairs.length === 0) {
    return "未发现可解释的钱包对关联。";
  }

  return [
    "| # | 钱包对 | 涉及链 | 关联强度 | 评分 | 置信度 | 信号数 | 主要驱动 |",
    "| ---: | --- | --- | --- | ---: | --- | ---: | --- |",
    ...pairs.map((pair, index) => {
      const labels = pair.labels.join(" ↔ ");
      const reasons = pair.reasons.slice(0, 3).join("、");
      return `| ${index + 1} | ${labels} | ${formatChainShortNames(pair.chainIds)} | ${formatStrength(pair.strength)} | ${pair.score} | ${formatConfidenceZh(pair.confidence)} | ${pair.signalCount} | ${reasons || "—"} |`;
    }),
  ].join("\n");
}

const chainShortNames: Record<number, string> = {
  1: "ETH",
  42161: "ARB",
  8453: "BASE",
  10: "OP",
  137: "POLY",
  56: "BSC",
  101: "SOL",
};

function formatChainShortNames(chainIds?: number[]): string {
  if (!chainIds?.length) {
    return "—";
  }

  return chainIds.map((chainId) => chainShortNames[chainId] ?? String(chainId)).join(" · ");
}

function formatGroupedFindings(findings: ReportFinding[]): string {
  if (findings.length === 0) {
    return "本次分析未生成详细发现。";
  }

  const groups = summarizeFindings(findings);

  return groups
    .map((group, index) => {
      const samples = findings.filter((finding) => finding.title === group.title).slice(0, 3);
      const evidenceRows = samples.flatMap((finding) => finding.evidence.slice(0, 2));

      return [
        `### 6.${index + 1} ${group.title}`,
        "",
        `> 共 **${group.count}** 条 · 风险 **${formatSeverityZh(group.severity)}** · 置信度 **${formatConfidenceZh(group.confidence)}** · 累计影响 **${group.scoreImpact}**`,
        "",
        group.description,
        "",
        formatEvidenceTable(evidenceRows, group.count, samples[0]?.evidenceTruncated),
        "",
      ].join("\n");
    })
    .join("\n");
}

function formatEvidenceTable(
  evidence: ReportEvidenceRef[],
  totalCount: number,
  truncated?: boolean,
): string {
  if (evidence.length === 0) {
    return "_无可展示的交易证据。_";
  }

  const rows = evidence.map((item, index) => {
    const event = item.event;
    const txHash = item.txHash ?? event?.txHash ?? "—";
    const block = event?.blockNumber ?? "—";
    const time = event?.timestamp ? formatTimestampZh(event.timestamp) : "—";
    const summary = item.summary.replace(/\|/g, "\\|");

    return `| ${index + 1} | \`${txHash}\` | ${block} | ${time} | ${summary} |`;
  });

  const footer =
    truncated || totalCount > evidence.length
      ? `\n_注：以上仅展示部分证据样本（共 ${totalCount} 条相关发现）。_`
      : "";

  return [
    "| # | 交易哈希 | 区块 | 时间 | 摘要 |",
    "| ---: | --- | ---: | --- | --- |",
    ...rows,
    footer,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatReviewerSection(report: AnalysisReport): string {
  return [
    "### 支持信号",
    "",
    report.score.reasons.length > 0
      ? report.score.reasons.map((reason) => `- ${reason}`).join("\n")
      : "- 无",
    "",
    "### 反证 / 降权因素",
    "",
    report.score.counterEvidence.length > 0
      ? report.score.counterEvidence.map((item) => `- ${item}`).join("\n")
      : "- 无",
  ].join("\n");
}

function formatRunNotes(report: AnalysisReport): string {
  const lines: string[] = [];

  if (report.meta?.fallbackReason) {
    lines.push(`- **回退说明**：${report.meta.fallbackReason}`);
  }

  for (const warning of report.meta?.warnings ?? []) {
    lines.push(`- **警告**：${warning}`);
  }

  return lines.join("\n");
}

function formatGraphTruncationNote(report: AnalysisReport): string {
  const notes: string[] = [];

  if (report.meta?.graphNodesTruncated) {
    notes.push("关系图谱节点在 UI 中已截断展示。");
  }

  if (report.meta?.graphEdgesTruncated) {
    notes.push("关系图谱边在 UI 中已截断展示。");
  }

  if (notes.length === 0) {
    return "";
  }

  return `\n> ${notes.join(" ")}`;
}

function formatMermaidOverview(report: AnalysisReport): string {
  const walletCount = report.metrics?.walletCount ?? countNodesByKind(report.graph, "wallet");
  const contractCount = report.metrics?.contractCount ?? countNodesByKind(report.graph, "contract");
  const edgeCount = report.metrics?.edgeCount ?? report.graph.edges.length;
  const findingCount = report.findings.length;
  const watched = report.metrics?.watchedAddressCount ?? "?";

  return [
    "```mermaid",
    "flowchart LR",
    `  W[\"监控地址<br/>${watched}\"] --> E[\"证据边<br/>${edgeCount}\"]`,
    `  E --> F[\"分析发现<br/>${findingCount}\"]`,
    `  E --> WN[\"钱包节点<br/>${walletCount}\"]`,
    `  E --> CN[\"合约节点<br/>${contractCount}\"]`,
    `  F --> S[\"关系评分<br/>${report.score.score}/100\"]`,
    "```",
  ].join("\n");
}

function formatVerdict(verdict: string | undefined): string {
  if (verdict === "strong") return "强关联";
  if (verdict === "medium") return "中等关联";
  if (verdict === "weak") return "弱关联";
  if (verdict === "none") return "无明显关联";
  return verdict ?? "待判定";
}

function formatStrength(value: string): string {
  if (value === "strong") return "强关联";
  if (value === "medium") return "中等关联";
  if (value === "weak") return "弱关联";
  return value;
}

function formatSeverityZh(value: string): string {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  if (value === "low") return "低";
  return "信息";
}

function formatConfidenceZh(value: string): string {
  if (value === "high") return "高";
  if (value === "medium") return "中";
  return "低";
}

function formatTimestampZh(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function countNodesByKind(graph: RelationshipGraph, kind: string): number {
  return graph.nodes.filter((node) => node.kind === kind).length;
}

interface SignalGroup {
  title: string;
  description: string;
  severity: Finding["severity"];
  confidence: Finding["confidence"];
  scoreImpact: number;
  count: number;
}

function summarizeFindings(findings: ReportFinding[]): SignalGroup[] {
  const groups = new Map<string, SignalGroup>();

  for (const finding of findings) {
    const existing = groups.get(finding.title);
    if (!existing) {
      groups.set(finding.title, {
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        confidence: finding.confidence,
        scoreImpact: finding.scoreImpact,
        count: 1,
      });
      continue;
    }

    existing.count += 1;
    existing.scoreImpact += finding.scoreImpact;
    existing.severity = pickHigherSeverity(existing.severity, finding.severity);
    existing.confidence = pickHigherConfidence(existing.confidence, finding.confidence);
  }

  return [...groups.values()].sort((a, b) => b.scoreImpact - a.scoreImpact || b.count - a.count);
}

function pickHigherSeverity(left: Finding["severity"], right: Finding["severity"]): Finding["severity"] {
  const rank = { info: 0, low: 1, medium: 2, high: 3 } as const;
  return rank[right] > rank[left] ? right : left;
}

function pickHigherConfidence(left: Finding["confidence"], right: Finding["confidence"]): Finding["confidence"] {
  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[right] > rank[left] ? right : left;
}

function redactReport(report: AnalysisReport, options: ExportOptions): AnalysisReport {
  if (!options.redactAddresses) {
    return report;
  }

  return redactValue(report) as AnalysisReport;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactAddresses(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactValue(entry)]));
  }

  return value;
}

function redactAddresses(value: string): string {
  return value.replace(/\b0x[a-fA-F0-9]{40}\b/g, (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  });
}
