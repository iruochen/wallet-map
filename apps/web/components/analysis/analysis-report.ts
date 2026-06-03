import type { AnalysisReport } from "@wallet-map/exporters";
import type { AnalysisResponse } from "./analysis-types";
import { formatAbsoluteTime } from "../../app/format";

function buildReportId(fetchedAt: string): string {
  const compact = fetchedAt.replace(/[-:TZ.]/g, "");
  return `WM-${compact.slice(0, 14)}`;
}

export function buildAnalysisReport(result: AnalysisResponse): AnalysisReport {
  return {
    title: "Wallet Map 链上关联分析报告",
    generatedAt: formatAbsoluteTime(result.meta.fetchedAt) ?? result.meta.fetchedAt,
    scope: result.meta.chainName,
    sourceLabel: result.sourceLabel ?? result.source,
    graph: {
      nodes: result.graph.nodes,
      edges: result.graph.edges.map((edge) => ({
        ...edge,
        weight: edge.weight ?? 1,
      })),
    },
    findings: result.findings.map((finding) => ({
      id: finding.id,
      analyzerId: finding.analyzerId,
      title: finding.title,
      description: finding.description,
      severity: finding.severity as AnalysisReport["findings"][number]["severity"],
      confidence: finding.confidence as AnalysisReport["findings"][number]["confidence"],
      scoreImpact: finding.scoreImpact,
      evidenceTotal: finding.evidenceTotal,
      evidenceTruncated: finding.evidenceTruncated,
      evidence: finding.evidence,
    })),
    score: result.score,
    summary: result.summary,
    metrics: {
      watchedAddressCount: result.meta.watchedAddressCount,
      eventCount: result.meta.eventCount,
      walletCount: result.meta.graphWalletCount,
      contractCount: result.meta.graphContractCount,
      edgeCount: result.graph.totalEdges,
    },
    meta: {
      reportId: buildReportId(result.meta.fetchedAt),
      chainName: result.meta.chainName,
      chainId: result.meta.chainId,
      dataProvider: result.meta.dataProvider,
      resolvedMode: result.meta.resolvedMode,
      fallbackReason: result.meta.fallbackReason,
      warnings: result.meta.warnings,
      fetchedAt: result.meta.fetchedAt,
      graphNodesTruncated: result.graph.nodesTruncated,
      graphEdgesTruncated: result.graph.edgesTruncated,
    },
  };
}
