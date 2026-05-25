import { createDefaultAnalyzers } from "@wallet-map/analyzers";
import { runAnalysis } from "@wallet-map/core";
import { resolveAnalyzeEvents } from "./data-source";
import { parseAnalyzeRequest } from "./schema";

const graphNodePreviewLimit = 120;
const graphEdgePreviewLimit = 160;
const findingEvidencePreviewLimit = 10;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );
    const resolved = await resolveAnalyzeEvents(parsed);
    const result = await runAnalysis({
      watchedAddresses: parsed.addresses,
      events: resolved.events,
      analyzers: createDefaultAnalyzers(),
    });

    return Response.json({
      mode: resolved.mode,
      source: resolved.source,
      input: parsed,
      meta: {
        chainId: parsed.chainId,
        chainName: resolved.chainName,
        requestedMode: parsed.dataMode,
        resolvedMode: resolved.mode,
        watchedAddressCount: parsed.addresses.length,
        eventCount: resolved.events.length,
        graphNodeCount: result.graph.nodes.length,
        graphEdgeCount: result.graph.edges.length,
        graphWalletCount: result.graph.nodes.filter((node) => node.kind === "wallet").length,
        graphContractCount: result.graph.nodes.filter((node) => node.kind === "contract").length,
        fallbackReason: resolved.fallbackReason,
        fetchedAt: new Date().toISOString(),
      },
      graph: {
        totalNodes: result.graph.nodes.length,
        totalEdges: result.graph.edges.length,
        nodesTruncated: result.graph.nodes.length > graphNodePreviewLimit,
        edgesTruncated: result.graph.edges.length > graphEdgePreviewLimit,
        nodes: result.graph.nodes.slice(0, graphNodePreviewLimit),
        edges: result.graph.edges.slice(0, graphEdgePreviewLimit),
      },
      findings: result.findings.map((finding) => ({
        ...finding,
        evidenceTotal: finding.evidence.length,
        evidenceTruncated: finding.evidence.length > findingEvidencePreviewLimit,
        evidence: finding.evidence.slice(0, findingEvidencePreviewLimit),
      })),
      score: result.score,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}
