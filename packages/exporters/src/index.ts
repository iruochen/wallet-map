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
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const page = {
      width: doc.internal.pageSize.getWidth(),
      height: doc.internal.pageSize.getHeight(),
      margin: 42,
    };
    const contentWidth = page.width - page.margin * 2;
    let y = page.margin;

    drawHeader(doc, safeReport, page.margin, y, contentWidth);
    y += 112;
    drawScoreCards(doc, safeReport, page.margin, y, contentWidth);
    y += 108;
    drawGraphBars(doc, safeReport, page.margin, y, contentWidth);
    y += 120;
    y = drawSectionText(doc, "Executive summary", formatSummary(safeReport), page.margin, y, contentWidth);
    y += 18;
    y = drawFindingBars(doc, safeReport.findings.slice(0, 6), page.margin, y, contentWidth);

    if (safeReport.summary?.pairInsights?.length) {
      if (y > page.height - 160) {
        doc.addPage();
        y = page.margin;
      }
      y = drawSectionText(
        doc,
        "Wallet pair insights",
        safeReport.summary.pairInsights
          .slice(0, 4)
          .map((pair) => `${pair.labels.join(" <-> ")}: ${pair.strength}, ${pair.signalCount} signals`)
          .join("\n"),
        page.margin,
        y + 12,
        contentWidth,
      );
    }

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

function drawHeader(
  doc: jsPDF,
  report: AnalysisReport,
  x: number,
  y: number,
  width: number,
): void {
  doc.setFillColor(24, 61, 48);
  doc.roundedRect(x, y, width, 82, 14, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Wallet Map Relationship Report", x + 24, y + 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Generated: ${report.generatedAt}`, x + 24, y + 56);
  doc.text(`Scope: ${report.scope ?? "unknown"} | Source: ${report.sourceLabel ?? "unknown"}`, x + 24, y + 72);
}

function drawScoreCards(
  doc: jsPDF,
  report: AnalysisReport,
  x: number,
  y: number,
  width: number,
): void {
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
}

function drawGraphBars(
  doc: jsPDF,
  report: AnalysisReport,
  x: number,
  y: number,
  width: number,
): void {
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
}

function drawSectionText(
  doc: jsPDF,
  title: string,
  body: string,
  x: number,
  y: number,
  width: number,
): number {
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(76, 91, 81);
  const lines = doc.splitTextToSize(body, width);
  doc.text(lines, x, y + 18);
  return y + 18 + lines.length * 12;
}

function drawFindingBars(
  doc: jsPDF,
  findings: Finding[],
  x: number,
  y: number,
  width: number,
): number {
  doc.setTextColor(36, 49, 41);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Signal highlights", x, y);

  if (findings.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(76, 91, 81);
    doc.text("No findings were generated.", x, y + 20);
    return y + 40;
  }

  findings.forEach((finding, index) => {
    const rowY = y + 24 + index * 34;
    const barWidth = Math.max(12, (finding.scoreImpact / 40) * (width - 180));
    doc.setTextColor(36, 49, 41);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(finding.title.slice(0, 54), x, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(92, 105, 96);
    doc.text(`Risk ${formatSeverity(finding.severity)} | Confidence ${formatConfidence(finding.confidence)}`, x, rowY + 12);
    doc.setFillColor(244, 246, 242);
    doc.roundedRect(x + 270, rowY - 8, width - 300, 10, 4, 4, "F");
    doc.setFillColor(184, 120, 16);
    doc.roundedRect(x + 270, rowY - 8, barWidth, 10, 4, 4, "F");
    doc.setTextColor(36, 49, 41);
    doc.text(String(finding.scoreImpact), x + width - 24, rowY);
  });

  return y + 34 + findings.length * 34;
}

function drawFooter(doc: jsPDF, page: { width: number; height: number; margin: number }): void {
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
