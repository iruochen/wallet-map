import type { ChainId, GraphNode } from "@wallet-map/core";
import type { LabelProvider, LabelSink, NodeLabel } from "@wallet-map/labels";
import type { LabelRepository } from "@wallet-map/storage";
import { createClient, type RedisClientType } from "redis";

export function createRepositoryLabelProvider(repository: LabelRepository): LabelProvider {
  return {
    id: "postgres-known-labels",
    async findLabels(input) {
      const labels: NodeLabel[] = [];

      for (const [chainId, nodes] of groupNodesByChain(input.nodes)) {
        try {
          const records = await repository.findKnownLabels({
            chainId,
            addresses: nodes.map((node) => node.address?.toLowerCase() ?? ""),
            nodeKinds: Array.from(new Set(nodes.map((node) => node.kind))),
          });

          labels.push(...records.map((record) => ({
            nodeKind: record.nodeKind,
            chainId: record.chainId,
            address: record.address,
            label: record.label,
            entity: record.entity,
            category: record.category as NodeLabel["category"],
            tags: record.tags,
            source: record.source,
            updatedAt: record.lastSeenAt,
          })));
        } catch {
          continue;
        }
      }

      return labels;
    },
  };
}

export function createRepositoryLabelSink(repository: LabelRepository): LabelSink {
  return {
    id: "postgres-known-labels",
    async saveLabels(labels) {
      await repository.upsertKnownLabels(labels.map((label) => ({
        id: buildLabelId(label),
        nodeKind: label.nodeKind ?? "wallet",
        chainId: label.chainId,
        address: label.address,
        label: label.label,
        entity: label.entity,
        category: label.category,
        tags: label.tags ?? [],
        source: label.source?.trim() || "unlabeled",
        lastSeenAt: label.updatedAt ?? new Date().toISOString(),
      })));
    },
  };
}

export function createRedisLabelProvider(options: {
  url: string;
  ttlSeconds?: number;
}): LabelProvider & LabelSink {
  let client: RedisClientType | undefined;
  const ttlSeconds = Math.max(60, options.ttlSeconds ?? 60 * 60 * 24 * 7);

  async function getClient(): Promise<RedisClientType> {
    if (!client) {
      client = createClient({ url: options.url });
      client.on("error", () => undefined);
      await client.connect();
    }

    return client;
  }

  return {
    id: "redis-label-cache",
    async findLabels(input) {
      const redis = await getClient().catch(() => undefined);

      if (!redis) {
        return [];
      }

      const keys = input.nodes
        .filter((node) => node.address && node.chainId !== undefined)
        .map(buildNodeCacheKey);

      if (keys.length === 0) {
        return [];
      }

      const values = await redis.mGet(keys).catch(() => []);

      return values
        .map((value) => value ? safeParseLabel(value) : undefined)
        .filter((label): label is NodeLabel => Boolean(label));
    },
    async saveLabels(labels) {
      const redis = await getClient().catch(() => undefined);

      if (!redis || labels.length === 0) {
        return;
      }

      await Promise.all(
        labels.map((label) =>
          redis.set(buildLabelCacheKey(label), JSON.stringify(label), { EX: ttlSeconds }),
        ),
      );
    },
  };
}

function groupNodesByChain(nodes: GraphNode[]): Map<ChainId, GraphNode[]> {
  const groups = new Map<ChainId, GraphNode[]>();

  for (const node of nodes) {
    if (!node.address || node.chainId === undefined) {
      continue;
    }

    groups.set(node.chainId, [...(groups.get(node.chainId) ?? []), node]);
  }

  return groups;
}

function buildNodeCacheKey(node: GraphNode): string {
  return `wallet-map:label:${node.kind}:${node.chainId}:${node.address?.toLowerCase()}`;
}

function buildLabelCacheKey(label: NodeLabel): string {
  return `wallet-map:label:${label.nodeKind ?? "wallet"}:${label.chainId}:${label.address.toLowerCase()}`;
}

function buildLabelId(label: NodeLabel): string {
  return `${label.nodeKind ?? "wallet"}:${label.chainId}:${label.address.toLowerCase()}:${label.source ?? "unknown"}`;
}

function safeParseLabel(value: string): NodeLabel | undefined {
  try {
    return JSON.parse(value) as NodeLabel;
  } catch {
    return undefined;
  }
}
