import type { Finding, RelationshipGraph, RelationshipScore } from "@wallet-map/core";
import { jsPDF } from "jspdf";

export interface ExportOptions {
  redactAddresses?: boolean;
}

export interface AnalysisReport {
  title: string;
  generatedAt: string;
  scope?: string;
  sourceLabel?: string;
  graph: RelationshipGraph;
  findings: Finding[];
  score: RelationshipScore;
  summary?: {
    verdict?: string;
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
  };
  metrics?: {
    watchedAddressCount?: number;
    eventCount?: number;
    walletCount?: number;
    contractCount?: number;
    edgeCount?: number;
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
        schemaVersion: "1.0",
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
    const findings = formatFindings(safeReport.findings);

    return [
      `# ${safeReport.title}`,
      "",
      "> Wallet Map turns on-chain events into relationship signals. This report is designed for review, not as final attribution proof.",
      "",
      "| Field | Value |",
      "| --- | --- |",
      `| Generated at | ${safeReport.generatedAt} |`,
      `| Scope | ${safeReport.scope ?? "unknown"} |`,
      `| Data source | ${safeReport.sourceLabel ?? "unknown"} |`,
      "",
      "## Executive Summary",
      formatSummary(safeReport),
      "",
      "## Scorecard",
      "| Metric | Value |",
      "| --- | ---: |",
      `| Relationship score | ${safeReport.score.score}/100 |`,
      `| Overall confidence | ${formatConfidence(safeReport.score.confidence)} |`,
      `| Findings | ${safeReport.findings.length} |`,
      `| Edges | ${safeReport.metrics?.edgeCount ?? safeReport.graph.edges.length} |`,
      "",
      "## Visual Overview",
      formatMermaidOverview(safeReport),
      "",
      "## Wallet Pair Insights",
      formatPairInsights(safeReport.summary?.pairInsights ?? []),
      "",
      "## Signal Highlights",
      findings || "No findings.",
      "",
      "## Reviewer Notes",
      formatList("Supporting signals", safeReport.score.reasons),
      formatList("Counter evidence", safeReport.score.counterEvidence),
      "",
      "## Caution",
      "These results are analytical signals, not proof of common ownership or coordinated activity. Review the evidence, chain context, timing, and possible exchange, bridge, or contract-mediated flows before making decisions.",
      "",
    ].filter((line): line is string => line !== undefined).join("\n");
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
    let cursor: PdfCursor = { y: page.margin };

    drawHeader(doc, safeReport, page, cursor, contentWidth);
    drawSectionText(doc, "Executive Summary", formatPdfSummary(safeReport), page, cursor, contentWidth);
    drawScoreCards(doc, safeReport, page, cursor, contentWidth);
    drawGraphBars(doc, safeReport, page, cursor, contentWidth);
    drawFindingBars(doc, signalGroups.slice(0, 8), page, cursor, contentWidth);

    if (safeReport.summary?.pairInsights?.length) {
      drawSectionText(
        doc,
        "Wallet Pair Insights",
        safeReport.summary.pairInsights
          .slice(0, 6)
          .map((pair) => {
            const labels = pair.labels.map(formatPdfLabel).join(" <-> ");
            const reasons = pair.reasons.map(formatPdfLabel).slice(0, 3).join("; ");
            return `${labels}: ${formatPdfLabel(pair.strength)}, score ${pair.score}, confidence ${formatConfidence(pair.confidence)}, ${pair.signalCount} signals.${reasons ? ` ${reasons}` : ""}`;
          })
          .join("\n"),
        page,
        cursor,
        contentWidth,
      );
    }

    drawEvidenceAppendix(doc, safeReport.findings.slice(0, 12), page, cursor, contentWidth);

    drawFooter(doc, page);
    return doc.output("blob") as Blob;
  }
}

function formatSummary(report: AnalysisReport): string {
  if (report.summary?.headline || report.summary?.narrative) {
    return [
      report.summary.verdict ? `Verdict: ${report.summary.verdict}` : undefined,
      report.summary.headline ? `Headline: ${report.summary.headline}` : undefined,
      report.summary.narrative,
    ].filter(Boolean).join("\n\n");
  }

  return `This report reviews ${report.graph.nodes.length} graph nodes and ${report.graph.edges.length} relationship edges for signs of wallet association.`;
}

function formatPdfSummary(report: AnalysisReport): string {
  const metrics = report.metrics;
  const walletCount = metrics?.walletCount ?? countNodesByKind(report.graph, "wallet");
  const contractCount = metrics?.contractCount ?? countNodesByKind(report.graph, "contract");
  const edgeCount = metrics?.edgeCount ?? report.graph.edges.length;
  const eventCount = metrics?.eventCount ?? "unknown";
  const watchedCount = metrics?.watchedAddressCount ?? "unknown";
  const topSignals = summarizeFindings(report.findings)
    .slice(0, 4)
    .map((group) => `${group.title} x${group.count} (${formatSeverity(group.severity)} risk, ${formatConfidence(group.confidence)} confidence)`);
  const scoreDrivers = uniqueFormatted(report.score.reasons).slice(0, 5);
  const counterEvidence = uniqueFormatted(report.score.counterEvidence).slice(0, 4);

  return [
    report.summary?.headline ? `Conclusion: ${formatPdfLabel(report.summary.headline)}` : undefined,
    `Scope: reviewed ${watchedCount} watched wallets across ${eventCount} on-chain events. The graph contains ${walletCount} wallet nodes, ${contractCount} contract nodes, and ${edgeCount} evidence-backed edges.`,
    `Score: ${report.score.score}/100 with ${formatConfidence(report.score.confidence)} confidence.`,
    topSignals.length > 0
      ? `Primary signals: ${topSignals.join("; ")}.`
      : "No relationship findings were generated for this run.",
    scoreDrivers.length > 0 ? `Score drivers: ${scoreDrivers.join("; ")}.` : undefined,
    counterEvidence.length > 0
      ? `Counter evidence: ${counterEvidence.join("; ")}.`
      : undefined,
    "Reviewer note: treat these as analytical signals. Confirm timing, exchange or bridge behavior, and contract-mediated flows before drawing attribution conclusions.",
  ].filter(Boolean).join("\n\n");
}

function formatMermaidOverview(report: AnalysisReport): string {
  const walletCount = report.metrics?.walletCount ?? countNodesByKind(report.graph, "wallet");
  const contractCount = report.metrics?.contractCount ?? countNodesByKind(report.graph, "contract");
  const edgeCount = report.metrics?.edgeCount ?? report.graph.edges.length;
  const findingCount = report.findings.length;

  return [
    "```mermaid",
    "flowchart LR",
    `  A[\"Watched wallets<br/>${report.metrics?.watchedAddressCount ?? "unknown"}\"] --> B[\"Graph edges<br/>${edgeCount}\"]`,
    `  B --> C[\"Findings<br/>${findingCount}\"]`,
    `  B --> D[\"Wallet nodes<br/>${walletCount}\"]`,
    `  B --> E[\"Contract nodes<br/>${contractCount}\"]`,
    `  C --> F[\"Score<br/>${report.score.score}/100\"]`,
    "```",
  ].join("\n");
}

function formatPairInsights(
  pairs: NonNullable<NonNullable<AnalysisReport["summary"]>["pairInsights"]>,
): string {
  if (pairs.length === 0) {
    return "No wallet-pair insights.";
  }

  return pairs
    .map((pair) => {
      return `- ${pair.labels.join(" <-> ")}: ${pair.strength}, score ${pair.score}, confidence ${pair.confidence}, ${pair.signalCount} signals. ${pair.reasons.join("; ")}`;
    })
    .join("\n");
}

function formatFindings(findings: Finding[]): string {
  return findings
    .map((finding) =>
      [
        `### ${finding.title}`,
        "",
        "| Attribute | Value |",
        "| --- | --- |",
        `| Risk | ${formatSeverity(finding.severity)} |`,
        `| Confidence | ${formatConfidence(finding.confidence)} |`,
        `| Score impact | ${finding.scoreImpact} |`,
        `| Analyzer | ${finding.analyzerId} |`,
        "",
        finding.description,
        "",
        formatEvidence(finding),
      ].join("\n"),
    )
    .join("\n\n");
}

function formatEvidence(finding: Finding): string {
  if (finding.evidence.length === 0) {
    return "- Evidence: No transaction evidence attached.";
  }

  const lines = finding.evidence.map((evidence) => {
    const txHash = evidence.txHash ? `, tx: ${evidence.txHash}` : "";
    return `  - ${evidence.eventId}${txHash}: ${evidence.summary}`;
  });

  return ["- Evidence:", ...lines].join("\n");
}

function formatList(title: string, items: string[]): string {
  if (items.length === 0) {
    return `${title}: none`;
  }

  return [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n");
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

function summarizeFindings(findings: Finding[]): SignalGroup[] {
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

function drawHeader(doc: jsPDF, report: AnalysisReport, page: PdfPage, cursor: PdfCursor, width: number): void {
  const x = page.margin;
  const y = cursor.y;
  doc.setFillColor(24, 61, 48);
  doc.roundedRect(x, y, width, 82, 14, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Wallet Map Relationship Report", x + 24, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(formatPdfLabel(`Generated: ${report.generatedAt}`), x + 24, y + 56);
  drawPdfTextLine(
    doc,
    formatPdfLabel(`Scope: ${report.scope ?? "unknown"} | Source: ${report.sourceLabel ?? "unknown"}`),
    x + 24,
    y + 72,
    width - 48,
  );
  cursor.y += 112;
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

function drawEvidenceAppendix(
  doc: jsPDF,
  findings: Finding[],
  page: PdfPage,
  cursor: PdfCursor,
  width: number,
): void {
  const rows = findings
    .flatMap((finding) =>
      finding.evidence.slice(0, 2).map((evidence) => ({
        title: finding.title,
        evidence: evidence.summary || evidence.eventId,
        txHash: evidence.txHash,
      })),
    )
    .slice(0, 12);

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
    const evidenceLines = splitPdfText(doc, formatPdfLabel(row.evidence), width - 28).slice(0, 2);
    const rowHeight = 34 + evidenceLines.length * 10;
    ensurePageSpace(doc, page, cursor, rowHeight);
    const rowY = cursor.y;

    doc.setFillColor(252, 253, 251);
    doc.setDrawColor(225, 231, 223);
    doc.roundedRect(x, rowY - 10, width, rowHeight - 6, 7, 7, "FD");
    doc.setTextColor(36, 49, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.8);
    doc.text(truncatePdfText(formatPdfLabel(row.title), 78), x + 12, rowY + 3);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(76, 91, 81);
    evidenceLines.forEach((line, index) => {
      doc.text(line, x + 12, rowY + 16 + index * 10);
    });
    if (row.txHash) {
      doc.setTextColor(100, 115, 106);
      doc.text(`tx ${truncatePdfText(formatPdfLabel(row.txHash), 24)}`, x + width - 118, rowY + 3);
    }
    cursor.y += rowHeight;
  });
}

function drawFooter(doc: jsPDF, page: PdfPage): void {
  const count = doc.getNumberOfPages();
  for (let index = 1; index <= count; index += 1) {
    doc.setPage(index);
    doc.setDrawColor(225, 231, 223);
    doc.line(page.margin, page.height - 36, page.width - page.margin, page.height - 36);
    doc.setTextColor(100, 115, 106);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Analytical signals only. Review chain context before making decisions.", page.margin, page.height - 18);
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
    .replaceAll("地址", "addresses")
    .replaceAll("置信", "confidence")
    .replaceAll("风险", "risk")
    .replaceAll("分析", "analysis")
    .replaceAll("报告", "report")
    .replaceAll("·", "-");
}

function truncatePdfText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}...`;
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
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactValue(entry)]),
    );
  }

  return value;
}

function redactAddresses(value: string): string {
  return value.replace(/\b0x[a-fA-F0-9]{40}\b/g, (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  });
}
