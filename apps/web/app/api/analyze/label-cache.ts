import type { Address, ChainId, GraphNode, RelationshipGraph } from "@wallet-map/core";
import type { NodeLabel } from "@wallet-map/labels";
import { createAnalyzeLabelStack } from "./label-providers";

export async function warmWalletLabelCache(
  addresses: Address[],
  chainIds: ChainId[],
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const { providers } = createAnalyzeLabelStack(env);
  const nodes: GraphNode[] = addresses.flatMap((address) =>
    chainIds.map((chainId) => ({
      id: `wallet:${chainId}:${address.toLowerCase()}`,
      kind: "wallet" as const,
      address: address.toLowerCase(),
      chainId,
      tags: ["watched"],
    })),
  );

  if (nodes.length === 0) {
    return;
  }

  for (const provider of providers) {
    try {
      await provider.findLabels({ nodes, events: [] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[labels] warm cache via ${provider.id} failed:`, message);
    }
  }
}

export async function persistDiscoveredGraphLabels(
  graph: RelationshipGraph,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const { sinks } = createAnalyzeLabelStack(env);
  const labels = extractPersistableLabels(graph.nodes);

  if (labels.length === 0 || sinks.length === 0) {
    return;
  }

  await Promise.all(
    sinks.map(async (sink) => {
      try {
        await sink.saveLabels(labels);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[labels] persist via ${sink.id} failed:`, message);
      }
    }),
  );
}

function extractPersistableLabels(nodes: GraphNode[]): NodeLabel[] {
  const labels: NodeLabel[] = [];

  for (const node of nodes) {
    if (!node.address || node.chainId === undefined) {
      continue;
    }

    const metadata = node.metadata?.label as
      | { entity?: string; category?: string; source?: string; updatedAt?: string }
      | undefined;
    const source = metadata?.source;

    if (!source || !shouldPersistSource(source)) {
      continue;
    }

    if (!node.label) {
      continue;
    }

    labels.push({
      nodeKind: node.kind,
      chainId: node.chainId,
      address: node.address.toLowerCase(),
      label: node.label,
      entity: metadata?.entity,
      category: metadata?.category as NodeLabel["category"],
      tags: node.tags,
      source,
      updatedAt: metadata?.updatedAt,
    });
  }

  return labels;
}

function shouldPersistSource(source: string): boolean {
  return (
    source === "chainbase-address-labels" ||
    source === "etherscan-nametag" ||
    source === "known-entity-labels" ||
    source === "static-label-registry"
  );
}
