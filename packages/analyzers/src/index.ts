import type { AnalysisContext, Analyzer, Finding } from "@wallet-map/core";

export class DirectTransferAnalyzer implements Analyzer {
  id = "direct-transfer";
  name = "Direct Transfer Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const walletNodeIds = new Set(
      context.graph.nodes
        .filter((node) => node.kind === "wallet" && node.tags?.includes("watched"))
        .map((node) => node.id),
    );

    const directEdges = context.graph.edges.filter((edge) => {
      return (
        walletNodeIds.has(edge.source) &&
        walletNodeIds.has(edge.target) &&
        ["native_transfer", "token_transfer", "nft_transfer"].includes(edge.kind)
      );
    });

    return directEdges.map((edge) => ({
      id: `${this.id}:${edge.id}`,
      analyzerId: this.id,
      title: "Direct transfer found",
      description: "Two watched wallets have a direct transfer relationship.",
      severity: "high",
      confidence: "high",
      scoreImpact: 40,
      evidence: edge.evidenceEventIds.map((eventId) => {
        const event = context.events.find((candidate) => candidate.id === eventId);

        return {
          eventId,
          txHash: event?.txHash,
          summary: event
            ? `${event.type} on chain ${event.chainId} in transaction ${event.txHash}`
            : `Evidence event ${eventId}`,
        };
      }),
      metadata: {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      },
    }));
  }
}

export function createDefaultAnalyzers(): Analyzer[] {
  return [new DirectTransferAnalyzer()];
}
