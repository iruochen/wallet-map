import { JsonExporter, MarkdownExporter, PdfReportExporter } from "@wallet-map/exporters";
import type { AnalysisResponse } from "./analysis-types";
import { buildAnalysisReport } from "./analysis-report";

export type ReportDownloadFormat = "pdf" | "markdown" | "json" | "csv";

const reportFormatConfig: Record<
  ReportDownloadFormat,
  {
    extension: string;
    mimeType: string;
  }
> = {
  pdf: {
    extension: "pdf",
    mimeType: "application/pdf",
  },
  markdown: {
    extension: "md",
    mimeType: "text/markdown;charset=utf-8",
  },
  json: {
    extension: "json",
    mimeType: "application/json;charset=utf-8",
  },
  csv: {
    extension: "csv",
    mimeType: "text/csv;charset=utf-8",
  },
};

export function buildReportDownloadFilename(result: AnalysisResponse, format: ReportDownloadFormat): string {
  const date = new Date(result.meta.fetchedAt).toISOString().slice(0, 10);
  const config = reportFormatConfig[format];

  return `wallet-map-${date}.${config.extension}`;
}

export async function buildReportDownloadBlob(
  result: AnalysisResponse,
  format: ReportDownloadFormat,
): Promise<Blob> {
  const report = buildAnalysisReport(result);
  const config = reportFormatConfig[format];

  if (format === "pdf") {
    return new PdfReportExporter().export(report);
  }

  if (format === "csv") {
    return new Blob([buildEvidenceCsv(result)], { type: config.mimeType });
  }

  const body =
    format === "markdown"
      ? await new MarkdownExporter().export(report)
      : await new JsonExporter().export(report);

  return new Blob([body], { type: config.mimeType });
}

export async function downloadAnalysisReport(result: AnalysisResponse, format: ReportDownloadFormat): Promise<void> {
  const blob = await buildReportDownloadBlob(result, format);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = buildReportDownloadFilename(result, format);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildEvidenceCsv(result: AnalysisResponse): string {
  const rows = result.findings.flatMap((finding) =>
    finding.evidence.map((evidence) => {
      const event = evidence.event;

      return [
        finding.id,
        finding.analyzerId,
        finding.title,
        finding.severity,
        finding.confidence,
        String(finding.scoreImpact),
        evidence.eventId,
        evidence.txHash ?? event?.txHash ?? "",
        event?.chainId !== undefined ? String(event.chainId) : "",
        event?.blockNumber !== undefined ? String(event.blockNumber) : "",
        event?.timestamp ?? "",
        event?.type ?? "",
        event?.from ?? "",
        event?.to ?? "",
        event?.contract ?? "",
        event?.methodId ?? "",
        event?.amount ?? "",
        event?.asset?.symbol ?? "",
        evidence.summary,
      ];
    }),
  );

  return [
    [
      "finding_id",
      "analyzer_id",
      "finding_title",
      "severity",
      "confidence",
      "score_impact",
      "event_id",
      "tx_hash",
      "chain_id",
      "block_number",
      "timestamp",
      "event_type",
      "from",
      "to",
      "contract",
      "method_id",
      "amount",
      "asset_symbol",
      "summary",
    ],
    ...rows,
  ]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
