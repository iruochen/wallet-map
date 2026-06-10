import type { Finding, RelationshipGraph, RelationshipScore } from "@wallet-map/core";
import { jsPDF } from "jspdf";

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
    const signalGroups = summarizeFindings(safeReport.findings);
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const page: PdfPage = {
      width: doc.internal.pageSize.getWidth(),
      height: doc.internal.pageSize.getHeight(),
      margin: 42,
    };
    const contentWidth = page.width - page.margin * 2;
    const cursor: PdfCursor = { y: page.margin };

    drawCoverPage(doc, safeReport, page, cursor, contentWidth, signalGroups);
    doc.addPage();
    cursor.y = page.margin;
    drawPageKicker(doc, "Review Packet", "Signals, relationships, and evidence samples", page, cursor, contentWidth);
    drawScoreDimensionMatrix(doc, safeReport, page, cursor, contentWidth);
    drawGraphBars(doc, safeReport, page, cursor, contentWidth);
    drawSignalHighlights(doc, safeReport.summary?.signalHighlights ?? [], signalGroups, page, cursor, contentWidth);
    drawFindingBars(doc, signalGroups.slice(0, 8), page, cursor, contentWidth);
    drawPairInsightCards(doc, safeReport.summary?.pairInsights ?? [], page, cursor, contentWidth);

    doc.addPage();
    cursor.y = page.margin;
    drawPageKicker(doc, "Evidence Appendix", "Sample transactions for manual review", page, cursor, contentWidth);
    drawEvidenceAppendix(doc, safeReport.findings.slice(0, 16), page, cursor, contentWidth);
    drawMethodologyBox(doc, page, cursor, contentWidth);

    drawFooter(doc, safeReport, page);
    return doc.output("blob") as Blob;
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
    "| # | 钱包对 | 关联强度 | 评分 | 置信度 | 信号数 | 主要驱动 |",
    "| ---: | --- | --- | ---: | --- | ---: | --- |",
    ...pairs.map((pair, index) => {
      const labels = pair.labels.join(" ↔ ");
      const reasons = pair.reasons.slice(0, 3).join("、");
      return `| ${index + 1} | ${labels} | ${formatStrength(pair.strength)} | ${pair.score} | ${formatConfidenceZh(pair.confidence)} | ${pair.signalCount} | ${reasons || "—"} |`;
    }),
  ].join("\n");
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

function formatStrengthPdf(value: string): string {
  if (value === "strong") return "Strong";
  if (value === "medium") return "Moderate";
  if (value === "weak") return "Weak";
  if (value === "none") return "None";
  return formatPdfLabel(value);
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

function buildExecutiveOverview(report: AnalysisReport): {
  conclusion: string;
  scope: string;
  reviewNote: string;
} {
  const metrics = report.metrics;
  const walletCount = metrics?.walletCount ?? countNodesByKind(report.graph, "wallet");
  const contractCount = metrics?.contractCount ?? countNodesByKind(report.graph, "contract");
  const edgeCount = metrics?.edgeCount ?? report.graph.edges.length;
  const watchedCount = metrics?.watchedAddressCount ?? "unknown";
  const eventCount = metrics?.eventCount ?? "unknown";
  const topSignal = summarizeFindings(report.findings)[0];
  const pairCount = report.summary?.pairInsights?.length ?? 0;

  return {
    conclusion:
      `This run produced a ${formatStrength(report.summary?.verdict ?? "none").toLowerCase()} verdict with a ${report.score.score}/100 relationship score and ${formatConfidence(report.score.confidence).toLowerCase()} confidence.` +
      (topSignal ? ` The leading signal family is ${formatPdfLabel(topSignal.title)} (${topSignal.count} hits, ${formatSeverity(topSignal.severity).toLowerCase()} risk).` : " No signal family exceeded the reporting threshold."),
    scope:
      `Scope covered ${watchedCount} watched wallets and ${eventCount} on-chain events across ${report.meta?.chainName ?? report.scope ?? "the selected chain"}. Graph: ${walletCount} wallet nodes, ${contractCount} contract nodes, ${edgeCount} evidence edges.`,
    reviewNote:
      pairCount > 0
        ? `${pairCount} wallet pair insight${pairCount === 1 ? "" : "s"} require timing and intermediary-path review.`
        : "Review the evidence appendix before making attribution decisions; absence of a pair insight is not proof of no relationship.",
  };
}

function countNodesByKind(graph: RelationshipGraph, kind: string): number {
  return graph.nodes.filter((node) => node.kind === kind).length;
}

function formatSeverity(value: string): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  if (value === "low") return "Low";
  return "Informational";
}

function formatConfidence(value: string): string {
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Low";
}

interface PdfPage {
  width: number;
  height: number;
  margin: number;
}

interface PdfCursor {
  y: number;
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

type PdfRgb = readonly [number, number, number];

const pdfPalette = {
  ink: [27, 35, 32],
  muted: [94, 107, 100],
  line: [214, 224, 217],
  paper: [250, 252, 249],
  panel: [244, 248, 244],
  forest: [24, 61, 48],
  green: [31, 107, 61],
  amber: [184, 120, 16],
  blue: [55, 87, 201],
  red: [166, 58, 58],
} as const satisfies Record<string, PdfRgb>;

function drawCoverPage(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
  signalGroups: SignalGroup[],
): void {
  drawHeader(doc, report, page, cursor, width);
  drawVerdictRibbon(doc, report, page, cursor, width);
  drawExecutiveBrief(doc, report, page, cursor, width);
  drawMetaCards(doc, report, page, cursor, width);
  drawCoverSignalPanel(doc, report, signalGroups, page, cursor, width);
  drawReviewerChecklist(doc, report, page, cursor, width);
}

function drawHeader(doc: jsPDF, report: AnalysisReport, page: PdfPage, cursor: PdfCursor, width: number): void {
  const x = page.margin;
  const y = cursor.y;
  setFill(doc, pdfPalette.forest);
  doc.roundedRect(x, y, width, 128, 16, 16, "F");
  setFill(doc, [36, 84, 66]);
  doc.roundedRect(x + width - 184, y, 184, 128, 16, 16, "F");
  setFill(doc, [49, 105, 82]);
  doc.circle(x + width - 48, y + 32, 34, "F");
  setFill(doc, [210, 231, 215]);
  doc.rect(x + width - 154, y + 82, 82, 4, "F");
  doc.rect(x + width - 124, y + 96, 112, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("WALLET MAP", x + 24, y + 28);
  doc.setFontSize(26);
  doc.text("Relationship", x + 24, y + 61);
  doc.text("Audit Report", x + 24, y + 91);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(formatPdfLabel(`Report ID ${report.meta?.reportId ?? "WM-UNKNOWN"}`), x + 24, y + 112);
  doc.text(formatPdfLabel(`Generated ${formatGeneratedAt(report.generatedAt)}`), x + width - 166, y + 112);
  drawPdfTextLine(
    doc,
    formatPdfLabel(`${report.scope ?? "Unknown scope"} | ${report.sourceLabel ?? "Unknown source"}`),
    x + width - 166,
    y + 34,
    132,
  );
  cursor.y += 150;
}

function drawVerdictRibbon(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const verdict = report.summary?.verdict ?? "none";
  const colors = {
    strong: pdfPalette.green,
    medium: pdfPalette.amber,
    weak: pdfPalette.blue,
    none: pdfPalette.muted,
  } as const satisfies Record<string, PdfRgb>;
  const color = colors[verdict as keyof typeof colors] ?? colors.none;

  ensurePageSpace(doc, page, cursor, 50);
  const x = page.margin;
  const y = cursor.y;
  setFill(doc, [250, 252, 249]);
  setDraw(doc, pdfPalette.line);
  doc.roundedRect(x, y, width, 42, 10, 10, "FD");
  setFill(doc, color);
  doc.roundedRect(x + 12, y + 11, 72, 20, 7, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(formatStrengthPdf(verdict).toUpperCase(), x + 22, y + 25);
  setText(doc, pdfPalette.ink);
  doc.setFontSize(10.5);
  doc.text(
    formatPdfLabel(`Score ${report.score.score}/100 | ${formatConfidence(report.score.confidence)} confidence | ${report.findings.length} findings`),
    x + 100,
    y + 26,
  );
  cursor.y += 58;
}

function drawMetaCards(doc: jsPDF, report: AnalysisReport, page: PdfPage, cursor: PdfCursor, width: number): void {
  ensurePageSpace(doc, page, cursor, 72);
  const x = page.margin;
  const y = cursor.y;
  const gap = 10;
  const cardWidth = (width - gap * 4) / 5;
  const cards = [
    { label: "Watched wallets", value: String(report.metrics?.watchedAddressCount ?? "—") },
    { label: "On-chain events", value: String(report.metrics?.eventCount ?? "—") },
    { label: "Wallet nodes", value: String(report.metrics?.walletCount ?? countNodesByKind(report.graph, "wallet")) },
    { label: "Contracts", value: String(report.metrics?.contractCount ?? countNodesByKind(report.graph, "contract")) },
    { label: "Evidence edges", value: String(report.metrics?.edgeCount ?? report.graph.edges.length) },
  ];

  cards.forEach((card, index) => {
    const left = x + index * (cardWidth + gap);
    setFill(doc, pdfPalette.paper);
    setDraw(doc, pdfPalette.line);
    doc.roundedRect(left, y, cardWidth, 58, 8, 8, "FD");
    setText(doc, pdfPalette.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.9);
    doc.text(card.label.toUpperCase(), left + 10, y + 17);
    setText(doc, pdfPalette.ink);
    doc.setFontSize(18);
    doc.text(card.value, left + 10, y + 43);
  });

  cursor.y += 76;
}

function drawExecutiveBrief(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const x = page.margin;
  const overview = buildExecutiveOverview(report);
  const drivers = uniqueFormatted(report.score.reasons).slice(0, 3);
  const summaryLines = [overview.conclusion, overview.scope, overview.reviewNote]
    .map((line) => truncatePdfText(formatPdfLabel(line), 96))
    .flatMap((line) => splitPdfText(doc, line, width - 216).slice(0, 2))
    .slice(0, 6);
  const cardHeight = Math.max(138, 50 + summaryLines.length * 12);

  ensurePageSpace(doc, page, cursor, cardHeight + 18);
  const y = cursor.y;

  setFill(doc, pdfPalette.paper);
  setDraw(doc, pdfPalette.line);
  doc.roundedRect(x, y, width, cardHeight, 12, 12, "FD");
  setFill(doc, [235, 242, 236]);
  doc.roundedRect(x + 14, y + 14, 28, cardHeight - 28, 8, 8, "F");
  setText(doc, pdfPalette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Executive Brief", x + 56, y + 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setText(doc, pdfPalette.muted);

  summaryLines.forEach((line, index) => {
    doc.text(line, x + 56, y + 48 + index * 12);
  });

  setFill(doc, pdfPalette.forest);
  doc.roundedRect(x + width - 160, y + 18, 128, 58, 10, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`${report.score.score}/100`, x + width - 142, y + 54);
  doc.setFontSize(8);
  doc.text("RELATIONSHIP SCORE", x + width - 142, y + 34);

  if (drivers.length > 0) {
    setText(doc, pdfPalette.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Top drivers", x + width - 160, y + 96);
    doc.setFont("helvetica", "normal");
    setText(doc, pdfPalette.muted);
    splitPdfText(doc, drivers.join(" | "), 140)
      .slice(0, 2)
      .forEach((line, index) => {
        doc.text(line, x + width - 160, y + 111 + index * 10);
      });
  }

  cursor.y += cardHeight + 18;
}

function drawScoreCards(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  ensurePageSpace(doc, page, cursor, 86);
  const x = page.margin;
  const y = cursor.y;
  const gap = 12;
  const cardWidth = (width - gap * 2) / 3;
  const cards = [
    { label: "Relationship score", value: `${report.score.score}/100`, color: [24, 61, 48] },
    { label: "Confidence", value: formatConfidence(report.score.confidence), color: [184, 120, 16] },
    { label: "Findings", value: String(report.findings.length), color: [55, 87, 201] },
  ] as const;

  cards.forEach((card, index) => {
    const left = x + index * (cardWidth + gap);
    doc.setFillColor(248, 251, 247);
    doc.setDrawColor(216, 227, 215);
    doc.roundedRect(left, y, cardWidth, 78, 10, 10, "FD");
    doc.setTextColor(92, 105, 96);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(card.label.toUpperCase(), left + 16, y + 24);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.setFontSize(22);
    doc.text(card.value, left + 16, y + 55);
  });
  cursor.y += 104;
}

function drawCoverSignalPanel(
  doc: jsPDF,
  report: AnalysisReport,
  signalGroups: SignalGroup[],
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  ensurePageSpace(doc, page, cursor, 112);
  const x = page.margin;
  const y = cursor.y;
  const leftWidth = Math.floor(width * 0.54);
  const rightX = x + leftWidth + 14;
  const topSignals = signalGroups.slice(0, 3);

  setFill(doc, pdfPalette.forest);
  doc.roundedRect(x, y, leftWidth, 108, 12, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOP SIGNAL FAMILIES", x + 18, y + 24);

  if (topSignals.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No analyzer signal passed the reporting threshold.", x + 18, y + 52);
  } else {
    topSignals.forEach((signal, index) => {
      const rowY = y + 44 + index * 20;
      const barWidth = clamp(signal.scoreImpact * 1.6, 24, leftWidth - 166);
      setFill(doc, [54, 103, 80]);
      doc.roundedRect(x + 18, rowY - 8, leftWidth - 36, 13, 6, 6, "F");
      setFill(doc, index === 0 ? [219, 238, 220] : [165, 203, 176]);
      doc.roundedRect(x + 18, rowY - 8, barWidth, 13, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text(truncatePdfText(formatPdfLabel(signal.title), 30), x + 28, rowY + 2);
      doc.text(`${signal.count} hits`, x + leftWidth - 72, rowY + 2);
    });
  }

  setFill(doc, pdfPalette.paper);
  setDraw(doc, pdfPalette.line);
  doc.roundedRect(rightX, y, width - leftWidth - 14, 108, 12, 12, "FD");
  setText(doc, pdfPalette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RUN CONTEXT", rightX + 16, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, pdfPalette.muted);
  [
    `Mode: ${report.meta?.resolvedMode ?? "unknown"}`,
    `Provider: ${report.meta?.dataProvider ?? report.sourceLabel ?? "unknown"}`,
    `Chain: ${report.meta?.chainName ?? report.scope ?? "unknown"}`,
    `Fetched: ${formatGeneratedAt(report.meta?.fetchedAt ?? report.generatedAt)}`,
  ].forEach((line, index) => {
    doc.text(truncatePdfText(formatPdfLabel(line), 42), rightX + 16, y + 44 + index * 13);
  });

  cursor.y += 128;
}

function drawReviewerChecklist(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const x = page.margin;
  const y = cursor.y;
  const items = [
    report.score.reasons[0] ? `Confirm leading driver: ${report.score.reasons[0]}` : "Confirm whether absence of signals matches the selected scope.",
    "Review exchange, bridge, and contract intermediaries before attribution.",
    report.score.counterEvidence[0]
      ? `Account for counter-evidence: ${report.score.counterEvidence[0]}`
      : "Check for public infrastructure that may lower review priority.",
  ].map((item) => truncatePdfText(formatPdfLabel(item), 88));

  ensurePageSpace(doc, page, cursor, 94);
  setFill(doc, [255, 252, 244]);
  setDraw(doc, [231, 218, 192]);
  doc.roundedRect(x, y, width, 82, 10, 10, "FD");
  setText(doc, pdfPalette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Reviewer checklist", x + 16, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, pdfPalette.muted);
  items.forEach((item, index) => {
    const dotY = y + 40 + index * 13;
    setDraw(doc, pdfPalette.amber);
    doc.circle(x + 19, dotY - 3, 3, "S");
    doc.text(item, x + 30, dotY);
  });
  cursor.y += 98;
}

function drawPageKicker(
  doc: jsPDF,
  title: string,
  subtitle: string,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const x = page.margin;
  const y = cursor.y;
  setText(doc, pdfPalette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, x, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, pdfPalette.muted);
  doc.text(formatPdfLabel(subtitle), x, y + 30);
  setDraw(doc, pdfPalette.line);
  doc.line(x, y + 44, x + width, y + 44);
  cursor.y += 66;
}

function drawScoreDimensionMatrix(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const x = page.margin;
  const dimensions = [
    ["Funding", report.score.dimensions.funding, pdfPalette.green],
    ["Destination", report.score.dimensions.destination, pdfPalette.blue],
    ["Contract", report.score.dimensions.contract, pdfPalette.amber],
    ["Temporal", report.score.dimensions.temporal, [118, 93, 171] as const],
    ["Asset", report.score.dimensions.asset, [64, 133, 147] as const],
  ] as const;

  ensurePageSpace(doc, page, cursor, 112);
  setText(doc, pdfPalette.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Score Dimension Matrix", x, cursor.y);
  cursor.y += 24;

  dimensions.forEach(([label, value, color], index) => {
    const rowY = cursor.y + index * 16;
    setText(doc, pdfPalette.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(label, x, rowY + 7);
    setFill(doc, pdfPalette.panel);
    doc.roundedRect(x + 88, rowY, width - 132, 8, 4, 4, "F");
    setFill(doc, color);
    doc.roundedRect(x + 88, rowY, Math.max(4, ((width - 132) * value) / 100), 8, 4, 4, "F");
    setText(doc, pdfPalette.ink);
    doc.setFont("helvetica", "bold");
    doc.text(`${value}`, x + width - 28, rowY + 7);
  });

  cursor.y += dimensions.length * 16 + 24;
}

function drawGraphBars(
  doc: jsPDF,
  report: AnalysisReport,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  ensurePageSpace(doc, page, cursor, 116);
  const x = page.margin;
  const y = cursor.y;
  const values = [
    ["Watched", report.metrics?.watchedAddressCount ?? 0],
    ["Events", report.metrics?.eventCount ?? 0],
    ["Wallet nodes", report.metrics?.walletCount ?? countNodesByKind(report.graph, "wallet")],
    ["Contract nodes", report.metrics?.contractCount ?? countNodesByKind(report.graph, "contract")],
    ["Edges", report.metrics?.edgeCount ?? report.graph.edges.length],
  ] as const;
  const max = Math.max(...values.map(([, value]) => Number(value)), 1);

  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Graph overview", x, y);

  values.forEach(([label, value], index) => {
    const rowY = y + 24 + index * 16;
    const barWidth = Math.max(8, (Number(value) / max) * (width - 150));
    doc.setTextColor(92, 105, 96);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(label, x, rowY + 8);
    doc.setFillColor(230, 239, 232);
    doc.roundedRect(x + 92, rowY, width - 140, 9, 4, 4, "F");
    doc.setFillColor(31, 107, 61);
    doc.roundedRect(x + 92, rowY, barWidth, 9, 4, 4, "F");
    doc.setTextColor(36, 49, 41);
    doc.text(String(value), x + width - 36, rowY + 8);
  });
  cursor.y += 122;
}

function drawSignalHighlights(
  doc: jsPDF,
  highlights: NonNullable<AnalysisReport["summary"]>["signalHighlights"],
  signalGroups: SignalGroup[],
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const rows =
    highlights && highlights.length > 0
      ? highlights.slice(0, 8).map((item) => ({
          title: item.title,
          meta: `${item.analyzerId} · count ${item.count}`,
        }))
      : signalGroups.slice(0, 8).map((group) => ({
          title: group.title,
          meta: `count ${group.count} · ${formatSeverity(group.severity)} · impact ${group.scoreImpact}`,
        }));

  ensurePageSpace(doc, page, cursor, 52);
  const x = page.margin;
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Signal Highlights", x, cursor.y);
  cursor.y += 22;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(76, 91, 81);
    doc.text("No signal highlights.", x, cursor.y);
    cursor.y += 28;
    return;
  }

  rows.forEach((row) => {
    ensurePageSpace(doc, page, cursor, 34);
    const rowY = cursor.y;
    doc.setFillColor(251, 252, 249);
    doc.setDrawColor(224, 231, 222);
    doc.roundedRect(x, rowY - 8, width, 28, 7, 7, "FD");
    doc.setTextColor(36, 49, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(truncatePdfText(formatPdfLabel(row.title), 72), x + 12, rowY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(92, 105, 96);
    doc.text(formatPdfLabel(row.meta), x + 12, rowY + 16);
    cursor.y += 32;
  });
  cursor.y += 8;
}

function drawSectionText(
  doc: jsPDF,
  title: string,
  body: string,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const x = page.margin;
  const safeBody = formatPdfLabel(body);
  const lines = splitPdfText(doc, safeBody, width);
  const titleHeight = 19;
  const lineHeight = 12;

  ensurePageSpace(doc, page, cursor, titleHeight + Math.min(lines.length, 8) * lineHeight + 18);
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(formatPdfLabel(title), x, cursor.y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(76, 91, 81);

  cursor.y += titleHeight;
  lines.forEach((line) => {
    ensurePageSpace(doc, page, cursor, lineHeight + 6);
    doc.text(line, x, cursor.y);
    cursor.y += lineHeight;
  });
  cursor.y += 18;
}

function drawFindingBars(
  doc: jsPDF,
  signals: SignalGroup[],
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const x = page.margin;
  ensurePageSpace(doc, page, cursor, 52);
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Signal Summary", x, cursor.y);
  cursor.y += 24;

  if (signals.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(76, 91, 81);
    doc.text("No findings were generated.", x, cursor.y);
    cursor.y += 40;
    return;
  }

  signals.forEach((signal) => {
    const rowHeight = 70;
    ensurePageSpace(doc, page, cursor, rowHeight);
    const rowY = cursor.y;
    const barMaxWidth = Math.max(20, width - 330);
    const barWidth = clamp((signal.scoreImpact / 80) * barMaxWidth, 12, barMaxWidth);
    const title = formatPdfLabel(signal.title);
    const description = splitPdfText(doc, formatPdfLabel(signal.description), width - 178).slice(0, 2);

    doc.setFillColor(251, 252, 249);
    doc.setDrawColor(224, 231, 222);
    doc.roundedRect(x, rowY - 12, width, rowHeight - 8, 8, 8, "FD");

    doc.setTextColor(36, 49, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(truncatePdfText(title, 72), x + 14, rowY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(92, 105, 96);
    doc.text(
      `Count ${signal.count} | Risk ${formatSeverity(signal.severity)} | Confidence ${formatConfidence(signal.confidence)}`,
      x + 14,
      rowY + 17,
    );
    description.forEach((line, descriptionIndex) => {
      doc.text(line, x + 14, rowY + 31 + descriptionIndex * 10);
    });
    doc.setFillColor(244, 246, 242);
    doc.roundedRect(x + 280, rowY - 2, barMaxWidth, 10, 4, 4, "F");
    doc.setFillColor(184, 120, 16);
    doc.roundedRect(x + 280, rowY - 2, barWidth, 10, 4, 4, "F");
    doc.setTextColor(36, 49, 41);
    doc.text(String(signal.scoreImpact), x + width - 30, rowY + 6);
    cursor.y += rowHeight;
  });
  cursor.y += 8;
}

function drawPairInsightCards(
  doc: jsPDF,
  pairs: NonNullable<NonNullable<AnalysisReport["summary"]>["pairInsights"]>,
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  ensurePageSpace(doc, page, cursor, 48);
  const x = page.margin;
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Wallet Pair Insights", x, cursor.y);
  cursor.y += 22;

  if (pairs.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(76, 91, 81);
    doc.text("No wallet pair insight was generated.", x, cursor.y);
    cursor.y += 34;
    return;
  }

  pairs.slice(0, 6).forEach((pair, index) => {
    const rowHeight = 88;
    ensurePageSpace(doc, page, cursor, rowHeight);
    const rowY = cursor.y;
    const labels = pair.labels.map(formatPdfLabel).join(" -> ");
    const reasons = pair.reasons.map(formatPdfLabel).slice(0, 3);

    doc.setFillColor(252, 253, 251);
    doc.setDrawColor(224, 231, 222);
    doc.roundedRect(x, rowY - 10, width, rowHeight - 8, 9, 9, "FD");
    doc.setFillColor(232, 241, 234);
    doc.roundedRect(x + 12, rowY, 24, 24, 8, 8, "F");
    doc.setTextColor(31, 61, 44);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(String(index + 1), x + 20, rowY + 16);

    doc.setTextColor(36, 49, 41);
    doc.setFontSize(9.5);
    doc.text(truncatePdfText(labels, 70), x + 48, rowY + 8);
    doc.setTextColor(92, 105, 96);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      `Strength ${formatStrengthPdf(pair.strength)} | Score ${pair.score} | ${formatConfidence(pair.confidence)} confidence | ${pair.signalCount} signals`,
      x + 48,
      rowY + 22,
    );

    reasons.forEach((reason, reasonIndex) => {
      const pillX = x + 48 + reasonIndex * 120;
      doc.setFillColor(246, 248, 244);
      doc.setDrawColor(218, 227, 217);
      doc.roundedRect(pillX, rowY + 38, 110, 20, 8, 8, "FD");
      doc.setTextColor(76, 91, 81);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text(truncatePdfText(reason, 18), pillX + 8, rowY + 51);
    });

    cursor.y += rowHeight;
  });
  cursor.y += 8;
}

function drawEvidenceAppendix(
  doc: jsPDF,
  findings: ReportFinding[],
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const rows = findings
    .flatMap((finding) =>
      finding.evidence.slice(0, 2).map((evidence) => ({
        title: finding.title,
        evidence: evidence.summary || evidence.eventId,
        txHash: evidence.txHash ?? evidence.event?.txHash,
        blockNumber: evidence.event?.blockNumber,
        timestamp: evidence.event?.timestamp,
      })),
    )
    .slice(0, 14);

  ensurePageSpace(doc, page, cursor, 54);
  const x = page.margin;
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Evidence Appendix", x, cursor.y);
  cursor.y += 20;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(76, 91, 81);
    doc.text("No transaction evidence was attached.", x, cursor.y);
    cursor.y += 34;
    return;
  }

  rows.forEach((row) => {
    const evidenceLines = splitPdfText(doc, truncatePdfText(formatPdfLabel(row.evidence), 96), width - 28).slice(0, 2);
    const metaParts = [
      row.txHash ? `tx ${truncateMiddle(formatPdfLabel(row.txHash), 24)}` : undefined,
      row.blockNumber ? `block ${row.blockNumber}` : undefined,
    ].filter(Boolean);
    const rowHeight = 62 + evidenceLines.length * 10;
    ensurePageSpace(doc, page, cursor, rowHeight);
    const rowY = cursor.y;

    doc.setFillColor(252, 253, 251);
    doc.setDrawColor(225, 231, 223);
    doc.roundedRect(x, rowY - 10, width, rowHeight - 6, 7, 7, "FD");
    doc.setTextColor(36, 49, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(truncatePdfText(formatPdfLabel(row.title), 64), x + 12, rowY + 3);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(76, 91, 81);
    if (metaParts.length > 0) {
      doc.setFontSize(8);
      doc.text(metaParts.join(" | "), x + 12, rowY + 16);
    }
    doc.setFontSize(8.8);
    evidenceLines.forEach((line, index) => {
      doc.text(line, x + 12, rowY + 30 + index * 10);
    });

    cursor.y += rowHeight;
  });
}

function drawMethodologyBox(doc: jsPDF, page: PdfPage, cursor: PdfCursor, width: number): void {
  const body =
    "Methodology: Wallet Map builds a relationship graph from watched wallet events and runs analyzers for direct transfers, shared counterparties, and shared contract interactions. Limitations: outputs are analytical signals, not attribution proof. Review exchange, bridge, and contract-mediated flows before making decisions.";
  drawSectionText(doc, "Methodology & Limitations", body, page, cursor, width);
}

function drawFooter(doc: jsPDF, report: AnalysisReport, page: PdfPage): void {
  const count = doc.getNumberOfPages();
  for (let index = 1; index <= count; index += 1) {
    doc.setPage(index);
    doc.setDrawColor(225, 231, 223);
    doc.line(page.margin, page.height - 36, page.width - page.margin, page.height - 36);
    doc.setTextColor(100, 115, 106);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      formatPdfLabel(`Wallet Map · ${report.meta?.reportId ?? "WM-UNKNOWN"} · Analytical signals only.`),
      page.margin,
      page.height - 18,
    );
    doc.text(`Page ${index}/${count}`, page.width - page.margin - 42, page.height - 18);
  }
}

function ensurePageSpace(doc: jsPDF, page: PdfPage, cursor: PdfCursor, requiredHeight: number): void {
  if (cursor.y + requiredHeight <= page.height - page.margin - 40) {
    return;
  }

  doc.addPage();
  cursor.y = page.margin;
}

function splitPdfText(doc: jsPDF, text: string, width: number): string[] {
  const lines = doc.splitTextToSize(formatPdfLabel(text), width) as string[];
  return lines.flatMap((line) => {
    if (line.length <= 110) return [line];
    return line.match(/.{1,110}/g) ?? [line];
  });
}

function drawPdfTextLine(doc: jsPDF, text: string, x: number, y: number, width: number): void {
  const [line] = splitPdfText(doc, text, width);
  doc.text(line ?? "", x, y);
}

function formatPdfLabel(value: string): string {
  return translatePdfTerms(value)
    .normalize("NFKD")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function uniqueFormatted(values: string[]): string[] {
  return [...new Set(values.map(formatPdfLabel).filter(Boolean))];
}

function translatePdfTerms(value: string): string {
  return value
    .replaceAll("强关联", "Strong relationship")
    .replaceAll("中等关联", "Moderate relationship")
    .replaceAll("弱关联", "Weak relationship")
    .replaceAll("无明显关联", "No clear relationship")
    .replaceAll("实时数据", "Live data")
    .replaceAll("本地样本", "Fixture data")
    .replaceAll("固定样本", "Fixture data")
    .replaceAll("监控地址", "watched wallets")
    .replaceAll("链上事件", "on-chain events")
    .replaceAll("证据边", "evidence edges")
    .replaceAll("钱包节点", "wallet nodes")
    .replaceAll("合约节点", "contract nodes")
    .replaceAll("关系评分", "relationship score")
    .replaceAll("分析发现", "findings")
    .replaceAll("地址", "addresses")
    .replaceAll("置信", "confidence")
    .replaceAll("风险", "risk")
    .replaceAll("分析", "analysis")
    .replaceAll("报告", "report")
    .replaceAll("·", "-");
}

function truncatePdfText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const sideLength = Math.max(4, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, sideLength)}...${value.slice(-sideLength)}`;
}

function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatPdfLabel(value);
  }

  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function setFill(doc: jsPDF, color: PdfRgb): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDraw(doc: jsPDF, color: PdfRgb): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: PdfRgb): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
