import { JsonExporter, MarkdownExporter, PdfReportExporter } from "@wallet-map/exporters";
import type { AnalysisResponse } from "./analysis-types";
import { buildAnalysisReport } from "./analysis-report";

export type ReportDownloadFormat = "pdf" | "markdown" | "json";

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
