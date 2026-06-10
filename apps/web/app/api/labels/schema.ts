import type { Address, ChainId, GraphNode } from "@wallet-map/core";
import type { KnownLabelRecord } from "@wallet-map/storage";

export const localLabelSource = "local-labels";

const labelCategories = [
  "exchange",
  "bridge",
  "dex",
  "defi",
  "stablecoin",
  "token",
  "contract",
  "wallet",
  "unknown",
] as const;

export type LocalLabelCategory = (typeof labelCategories)[number];

export type LabelSourceMode = "all" | "local-labels" | "discovered";

export interface LabelListQuery {
  chainId?: ChainId;
  source?: string;
  sourceMode: LabelSourceMode;
  query?: string;
  limit: number;
  offset: number;
}

export interface LocalLabelInput {
  nodeKind: GraphNode["kind"];
  chainId: ChainId;
  address: Address;
  label: string;
  entity?: string;
  category?: LocalLabelCategory;
  tags: string[];
}

export function parseLabelListQuery(url: URL): LabelListQuery {
  const chainId = readOptionalChainId(url.searchParams.get("chainId"));
  const limit = normalizeLimit(url.searchParams.get("limit"));
  const offset = normalizeOffset(url.searchParams.get("offset"));
  const source = normalizeOptionalText(url.searchParams.get("source"));
  const sourceMode = readSourceMode(url.searchParams.get("sourceMode"));
  const query = normalizeOptionalText(url.searchParams.get("query"));

  return {
    chainId,
    source,
    sourceMode,
    query,
    limit,
    offset,
  };
}

export function parseLocalLabelInput(input: unknown): LocalLabelInput {
  const payload = asPayload(input);
  const chainId = readRequiredChainId(payload.chainId);
  const nodeKind = readNodeKind(payload.nodeKind);
  const address = readAddress(payload.address);
  const label = readRequiredText(payload.label, "Label");
  const entity = normalizeOptionalText(payload.entity);
  const category = readCategory(payload.category);
  const tags = readTags(payload.tags);

  return {
    nodeKind,
    chainId,
    address,
    label,
    entity,
    category,
    tags,
  };
}

export function buildLocalLabelRecord(input: LocalLabelInput, now = new Date()): KnownLabelRecord {
  const timestamp = now.toISOString();

  return {
    id: `${input.nodeKind}:${input.chainId}:${input.address}:${localLabelSource}`,
    nodeKind: input.nodeKind,
    chainId: input.chainId,
    address: input.address,
    label: input.label,
    entity: input.entity,
    category: input.category,
    tags: input.tags,
    source: localLabelSource,
    confidence: 1,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    metadata: {
      managedBy: "wallet-map-local-label-manager",
    },
  };
}

function asPayload(input: unknown): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("A label payload object is required.");
  }

  return input as Record<string, unknown>;
}

function readOptionalChainId(value: string | null): ChainId | undefined {
  if (!value) {
    return undefined;
  }

  return parseChainId(value);
}

function readRequiredChainId(value: unknown): ChainId {
  return parseChainId(value);
}

function parseChainId(value: unknown): ChainId {
  const chainId = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(chainId) || chainId < 0) {
    throw new Error("A valid chain ID is required.");
  }

  return chainId;
}

function readNodeKind(value: unknown): GraphNode["kind"] {
  if (value === undefined || value === null || value === "") {
    return "wallet";
  }

  if (value === "wallet" || value === "contract" || value === "entity" || value === "asset") {
    return value;
  }

  throw new Error("Node kind must be wallet, contract, entity, or asset.");
}

function readAddress(value: unknown): Address {
  if (typeof value !== "string") {
    throw new Error("A valid EVM address is required.");
  }

  const normalized = value.trim().toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error("A valid EVM address is required.");
  }

  return normalized as Address;
}

function readRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  if (normalized.length > 120) {
    throw new Error(`${fieldName} must be 120 characters or fewer.`);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized ? normalized.slice(0, 120) : undefined;
}

function readCategory(value: unknown): LocalLabelCategory | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Category must be a supported label category.");
  }

  if (labelCategories.includes(value as LocalLabelCategory)) {
    return value as LocalLabelCategory;
  }

  throw new Error("Category must be a supported label category.");
}

function readTags(value: unknown): string[] {
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,，\s]+/)
      : [];
  const tags = rawTags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .map((tag) => tag.replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean);

  return Array.from(new Set(tags)).slice(0, 12);
}

function normalizeLimit(value: string | null): number {
  if (!value) {
    return 20;
  }

  const limit = Number(value);

  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(100, Math.max(1, Math.trunc(limit)));
}

function normalizeOffset(value: string | null): number {
  if (!value) {
    return 0;
  }

  const offset = Number(value);

  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.trunc(offset));
}

function readSourceMode(value: string | null): LabelSourceMode {
  if (value === "local-labels" || value === "discovered") {
    return value;
  }

  return "all";
}
