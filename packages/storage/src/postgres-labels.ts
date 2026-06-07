import { Pool, type PoolConfig } from "pg";
import type {
  Address,
  ChainId,
  GraphNode,
} from "@wallet-map/core";
import type {
  KnownLabelListInput,
  KnownLabelRecord,
  LabelLookupInput,
  LabelRepository,
} from "./index";

interface KnownLabelRow {
  id: string;
  node_kind: GraphNode["kind"];
  chain_id: ChainId;
  address: Address;
  label: string;
  entity: string | null;
  category: string | null;
  tags: string[];
  source: string;
  confidence: number | null;
  first_seen_at: Date | string | null;
  last_seen_at: Date | string | null;
  metadata: Record<string, unknown> | null;
}

export interface PostgresLabelRepositoryOptions {
  connectionString?: string;
  pool?: Pool;
  poolConfig?: PoolConfig;
}

export function createPostgresLabelRepository(
  options: PostgresLabelRepositoryOptions = {},
): LabelRepository {
  const pool =
    options.pool ??
    new Pool({
      connectionString: options.connectionString ?? process.env.DATABASE_URL,
      ...options.poolConfig,
    });

  return {
    async findKnownLabels(input) {
      if (input.addresses.length === 0) {
        return [];
      }

      const result = await pool.query<KnownLabelRow>(
        `
          SELECT
            id,
            node_kind,
            chain_id,
            address,
            label,
            entity,
            category,
            tags,
            source,
            confidence,
            first_seen_at,
            last_seen_at,
            metadata
          FROM known_labels
          WHERE chain_id = $1
            AND address = ANY($2::text[])
            AND ($3::text[] IS NULL OR node_kind = ANY($3::text[]))
          ORDER BY
            CASE source
              WHEN 'chainbase-address-labels' THEN 0
              WHEN 'etherscan-nametag' THEN 1
              WHEN 'known-entity-labels' THEN 2
              WHEN 'static-label-registry' THEN 3
              ELSE 4
            END,
            updated_at DESC
        `,
        [
          input.chainId,
          input.addresses.map((address) => address.toLowerCase()),
          input.nodeKinds?.length ? input.nodeKinds : null,
        ],
      );

      return result.rows.map(mapKnownLabelRow);
    },
    async listKnownLabels(input = {}) {
      const filters: string[] = [];
      const values: Array<number | string> = [];
      const limit = normalizeListLimit(input.limit);

      if (input.chainId !== undefined) {
        values.push(input.chainId);
        filters.push(`chain_id = $${values.length}`);
      }

      if (input.source?.trim()) {
        values.push(input.source.trim());
        filters.push(`source = $${values.length}`);
      }

      if (input.query?.trim()) {
        values.push(`%${input.query.trim().toLowerCase()}%`);
        filters.push(`(
          lower(address) LIKE $${values.length}
          OR lower(label) LIKE $${values.length}
          OR lower(COALESCE(entity, '')) LIKE $${values.length}
          OR lower(source) LIKE $${values.length}
        )`);
      }

      values.push(limit);

      const result = await pool.query<KnownLabelRow>(
        `
          SELECT
            id,
            node_kind,
            chain_id,
            address,
            label,
            entity,
            category,
            tags,
            source,
            confidence,
            first_seen_at,
            last_seen_at,
            metadata
          FROM known_labels
          ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
          ORDER BY updated_at DESC, label ASC
          LIMIT $${values.length}
        `,
        values,
      );

      return result.rows.map(mapKnownLabelRow);
    },
    async upsertKnownLabels(labels) {
      for (const label of labels) {
        await pool.query(
          `
            INSERT INTO known_labels (
              id,
              node_kind,
              chain_id,
              address,
              label,
              entity,
              category,
              tags,
              source,
              confidence,
              first_seen_at,
              last_seen_at,
              metadata,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
            ON CONFLICT (node_kind, chain_id, address, source)
            DO UPDATE SET
              label = EXCLUDED.label,
              entity = EXCLUDED.entity,
              category = EXCLUDED.category,
              tags = EXCLUDED.tags,
              confidence = EXCLUDED.confidence,
              last_seen_at = EXCLUDED.last_seen_at,
              metadata = EXCLUDED.metadata,
              updated_at = now()
          `,
          [
            label.id,
            label.nodeKind,
            label.chainId,
            label.address.toLowerCase(),
            label.label,
            label.entity ?? null,
            label.category ?? null,
            label.tags,
            label.source,
            label.confidence ?? null,
            label.firstSeenAt ?? null,
            label.lastSeenAt ?? null,
            label.metadata ?? null,
          ],
        );
      }
    },
  };
}

export function toLabelLookupInput(nodes: GraphNode[], chainId: ChainId): LabelLookupInput {
  return {
    chainId,
    addresses: nodes
      .filter((node) => node.chainId === chainId && node.address)
      .map((node) => node.address?.toLowerCase() as Address),
    nodeKinds: Array.from(new Set(nodes.map((node) => node.kind))),
  };
}

function normalizeListLimit(limit: KnownLabelListInput["limit"]): number {
  if (limit === undefined) {
    return 100;
  }

  if (!Number.isFinite(limit)) {
    return 100;
  }

  return Math.min(250, Math.max(1, Math.trunc(limit)));
}

function mapKnownLabelRow(row: KnownLabelRow): KnownLabelRecord {
  return {
    id: row.id,
    nodeKind: row.node_kind,
    chainId: row.chain_id,
    address: row.address,
    label: row.label,
    entity: row.entity ?? undefined,
    category: row.category ?? undefined,
    tags: row.tags,
    source: row.source,
    confidence: row.confidence ?? undefined,
    firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at).toISOString() : undefined,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : undefined,
    metadata: row.metadata ?? undefined,
  };
}
