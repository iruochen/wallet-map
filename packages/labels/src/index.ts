import type {
  GraphEnricher,
  GraphNode,
  GraphNodeKind,
  NormalizedEvent,
  RelationshipGraph,
} from "@wallet-map/core";
import staticLabelEntries from "../data/static-labels.json";

export type LabelCategory =
  | "token"
  | "cex"
  | "bridge"
  | "dex"
  | "infrastructure"
  | "unknown";

export interface NodeLabel {
  nodeKind?: GraphNodeKind;
  chainId: number;
  address: string;
  label: string;
  entity?: string;
  category?: LabelCategory;
  tags?: string[];
  source?: string;
  updatedAt?: string;
}

export interface LabelLookupInput {
  nodes: GraphNode[];
  events: NormalizedEvent[];
}

export interface LabelProvider {
  id: string;
  findLabels(input: LabelLookupInput): Promise<NodeLabel[]>;
}

export interface EtherscanNametagProviderConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestThrottleMs?: number;
  maxAddresses?: number;
  onError?: (error: Error) => void;
}

export interface ChainbaseLabelProviderConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requestThrottleMs?: number;
  maxAddresses?: number;
  onError?: (error: Error) => void;
}

export interface LabelSink {
  id: string;
  saveLabels(labels: NodeLabel[]): Promise<void>;
}

export interface PersistingLabelProviderConfig {
  provider: LabelProvider;
  sinks: LabelSink[];
  onError?: (error: Error) => void;
}

interface EtherscanNametagResponse {
  status: string;
  message: string;
  result: unknown;
}

interface EtherscanNametagResult {
  address?: string;
  nametag?: string;
  internal_nametag?: string;
  labels?: string[];
  labels_slug?: string[];
  reputation?: number;
  lastupdatedtimestamp?: number;
}

interface ChainbaseLabelResponse {
  code: number;
  message: string;
  data?: unknown;
}

export interface LabelGraphEnricherOptions {
  providers: LabelProvider[];
}

const defaultStaticLabelEntries = staticLabelEntries as NodeLabel[];
const knownEntityLabelSource = "known-entity-labels";
const staticLabelRegistrySource = "static-label-registry";

export function createLabelGraphEnricher(
  options: LabelGraphEnricherOptions,
): GraphEnricher {
  return {
    id: "label-graph-enricher",
    async enrich(graph, events) {
      return enrichGraphWithLabels(graph, events, options.providers);
    },
  };
}

export async function enrichGraphWithLabels(
  graph: RelationshipGraph,
  events: NormalizedEvent[],
  providers: LabelProvider[],
): Promise<RelationshipGraph> {
  const labels = await loadLabels(graph.nodes, events, providers);

  return {
    ...graph,
    nodes: graph.nodes.map((node) => enrichNode(node, labels.get(buildNodeKey(node)))),
  };
}

export function createKnownEntityLabelProvider(entries: NodeLabel[] = defaultStaticLabelEntries): LabelProvider {
  const labelsByKey = new Map<string, NodeLabel>();

  for (const entry of entries) {
    labelsByKey.set(buildLabelKey(entry.chainId, entry.address, entry.nodeKind), {
      ...entry,
      address: entry.address.toLowerCase(),
      source: entry.source ?? knownEntityLabelSource,
    });
  }

  return {
    id: knownEntityLabelSource,
    async findLabels(input) {
      const labels: NodeLabel[] = [];

      for (const node of input.nodes) {
        const label = labelsByKey.get(buildNodeKey(node));

        if (label) {
          labels.push(label);
        }
      }

      return labels;
    },
  };
}

export function createEventAssetLabelProvider(): LabelProvider {
  return {
    id: "normalized-event-asset",
    async findLabels(input) {
      return buildTokenLabelsFromEvents(input.events);
    },
  };
}

export function createStaticLabelProvider(entries: NodeLabel[] = defaultStaticLabelEntries): LabelProvider {
  const knownEntityProvider = createKnownEntityLabelProvider(
    entries.map((entry) => ({
      ...entry,
      source: entry.source ?? staticLabelRegistrySource,
    })),
  );
  const eventAssetProvider = createEventAssetLabelProvider();

  return {
    id: staticLabelRegistrySource,
    async findLabels(input) {
      const knownEntityLabels = await knownEntityProvider.findLabels(input);
      const knownKeys = new Set(
        knownEntityLabels.map((label) => buildLabelKey(label.chainId, label.address, label.nodeKind)),
      );
      const eventAssetLabels = (await eventAssetProvider.findLabels(input)).filter((label) => {
        const key = buildLabelKey(label.chainId, label.address, label.nodeKind);
        return !knownKeys.has(key);
      });

      return [...knownEntityLabels, ...eventAssetLabels];
    },
  };
}

export function createEtherscanNametagProvider(
  config: EtherscanNametagProviderConfig,
): LabelProvider {
  const apiKey = config.apiKey.trim();
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const baseUrl = config.baseUrl ?? "https://api.etherscan.io/v2/api";
  const requestThrottleMs = Math.max(0, config.requestThrottleMs ?? 500);
  const maxAddresses = Math.max(1, config.maxAddresses ?? 50);

  return {
    id: "etherscan-nametag",
    async findLabels(input) {
      if (!apiKey) {
        return [];
      }

      const labels: NodeLabel[] = [];
      const nodes = input.nodes
        .filter((node) => node.address && node.chainId !== undefined)
        .slice(0, maxAddresses);

      for (const [index, node] of nodes.entries()) {
        if (index > 0 && requestThrottleMs > 0) {
          await sleep(requestThrottleMs);
        }

        try {
          const label = await fetchEtherscanNametag({
            apiKey,
            baseUrl,
            fetchImpl,
            node,
          });

          if (label) {
            labels.push(label);
          }
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          config.onError?.(normalizedError);
        }
      }

      return labels;
    },
  };
}

export function createChainbaseLabelProvider(config: ChainbaseLabelProviderConfig): LabelProvider {
  const apiKey = config.apiKey.trim();
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  const baseUrl = config.baseUrl ?? "https://api.chainbase.online/v1/address/labels";
  const requestThrottleMs = Math.max(0, config.requestThrottleMs ?? 350);
  const maxAddresses = Math.max(1, config.maxAddresses ?? 50);

  return {
    id: "chainbase-address-labels",
    async findLabels(input) {
      if (!apiKey) {
        return [];
      }

      const labels: NodeLabel[] = [];
      const nodes = input.nodes
        .filter((node) => node.address && node.chainId !== undefined)
        .slice(0, maxAddresses);

      for (const [index, node] of nodes.entries()) {
        if (index > 0 && requestThrottleMs > 0) {
          await sleep(requestThrottleMs);
        }

        try {
          const label = await fetchChainbaseLabel({
            apiKey,
            baseUrl,
            fetchImpl,
            node,
          });

          if (label) {
            labels.push(label);
          }
        } catch (error) {
          const normalizedError = error instanceof Error ? error : new Error(String(error));
          config.onError?.(normalizedError);
        }
      }

      return labels;
    },
  };
}

export function createPersistingLabelProvider(config: PersistingLabelProviderConfig): LabelProvider {
  return {
    id: `${config.provider.id}:persisting`,
    async findLabels(input) {
      const labels = await config.provider.findLabels(input);

      if (labels.length === 0) {
        return labels;
      }

      await Promise.all(
        config.sinks.map(async (sink) => {
          try {
            await sink.saveLabels(labels);
          } catch (error) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));
            config.onError?.(normalizedError);
          }
        }),
      );

      return labels;
    },
  };
}

function buildTokenLabelsFromEvents(events: NormalizedEvent[]): NodeLabel[] {
  const labels = new Map<string, NodeLabel>();

  for (const event of events) {
    const contract = event.asset?.contract ?? event.contract;
    const symbol = event.asset?.symbol;

    if (!contract || !symbol) {
      continue;
    }

    const label: NodeLabel = {
      nodeKind: "contract",
      chainId: event.chainId,
      address: contract.toLowerCase(),
      label: symbol,
      category: "token",
      tags: ["token"],
      source: "normalized-event-asset",
    };

    labels.set(buildLabelKey(label.chainId, label.address, label.nodeKind), label);
  }

  return Array.from(labels.values());
}

async function fetchEtherscanNametag(input: {
  apiKey: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  node: GraphNode;
}): Promise<NodeLabel | undefined> {
  if (!input.node.address || input.node.chainId === undefined) {
    return undefined;
  }

  const url = new URL(input.baseUrl);
  url.searchParams.set("module", "nametag");
  url.searchParams.set("action", "getaddresstag");
  url.searchParams.set("chainid", String(input.node.chainId));
  url.searchParams.set("address", input.node.address);
  url.searchParams.set("apikey", input.apiKey);

  const response = await input.fetchImpl(url);

  if (!response.ok) {
    throw new Error(`Etherscan nametag request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as EtherscanNametagResponse;

  if (payload.status !== "1") {
    throw new Error(`Etherscan nametag request failed: ${payload.message}`);
  }

  const result = Array.isArray(payload.result)
    ? (payload.result[0] as EtherscanNametagResult | undefined)
    : undefined;
  const label = result?.nametag?.trim() || result?.internal_nametag?.trim();

  if (!result?.address || !label) {
    return undefined;
  }

  const tags = [
    "known_entity",
    ...(result.labels_slug?.filter(Boolean) ?? result.labels?.map(slugifyLabel).filter(Boolean) ?? []),
  ];

  return {
    nodeKind: input.node.kind,
    chainId: input.node.chainId,
    address: result.address.toLowerCase(),
    label,
    entity: result.labels?.[0],
    category: inferCategory(result.labels_slug ?? result.labels),
    tags,
    source: "etherscan-nametag",
    updatedAt: result.lastupdatedtimestamp
      ? new Date(result.lastupdatedtimestamp * 1000).toISOString()
      : undefined,
  };
}

async function fetchChainbaseLabel(input: {
  apiKey: string;
  baseUrl: string;
  fetchImpl: typeof fetch;
  node: GraphNode;
}): Promise<NodeLabel | undefined> {
  if (!input.node.address || input.node.chainId === undefined) {
    return undefined;
  }

  const url = new URL(input.baseUrl);
  url.searchParams.set("chain_id", String(input.node.chainId));
  url.searchParams.set("address", input.node.address);

  const response = await input.fetchImpl(url, {
    headers: {
      "x-api-key": input.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Chainbase label request failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as ChainbaseLabelResponse;

  if (payload.code !== 0) {
    throw new Error(`Chainbase label request failed: ${payload.message}`);
  }

  return normalizeChainbaseLabel({
    node: input.node,
    data: payload.data,
  });
}

function normalizeChainbaseLabel(input: {
  node: GraphNode;
  data: unknown;
}): NodeLabel | undefined {
  const records = collectChainbaseRecords(input.data);

  if (records.length === 0 || !input.node.address || input.node.chainId === undefined) {
    return undefined;
  }

  const label = records.map(readDisplayLabel).find((value): value is string => Boolean(value));
  const entity = records.map(readEntityLabel).find((value): value is string => Boolean(value));
  const category = records.map(readCategory).find((value): value is LabelCategory => Boolean(value));
  const tags = Array.from(new Set([
    "known_entity",
    ...records.flatMap(readTags),
    ...(category ? [category] : []),
  ])).filter(Boolean);

  if (!label && !entity && (!category || category === "unknown")) {
    return undefined;
  }

  return {
    nodeKind: input.node.kind,
    chainId: input.node.chainId,
    address: input.node.address.toLowerCase(),
    label: label ?? entity ?? category ?? "Known address",
    entity,
    category,
    tags,
    source: "chainbase-address-labels",
  };
}

function collectChainbaseRecords(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== "object") {
    return [];
  }

  const records: Array<Record<string, unknown>> = [];

  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      records.push(...value.filter(isRecord));
      continue;
    }

    if (isRecord(value)) {
      records.push(value);
    }
  }

  return records;
}

async function loadLabels(
  nodes: GraphNode[],
  events: NormalizedEvent[],
  providers: LabelProvider[],
): Promise<Map<string, NodeLabel>> {
  const labels = new Map<string, NodeLabel>();

  for (const provider of providers) {
    const unresolvedNodes = nodes.filter((node) => !labels.has(buildNodeKey(node)));

    if (unresolvedNodes.length === 0) {
      break;
    }

    const providerLabels = await provider.findLabels({ nodes: unresolvedNodes, events });

    for (const label of providerLabels) {
      const key = buildLabelKey(label.chainId, label.address, label.nodeKind);

      if (!labels.has(key) && isUsefulLabel(label)) {
        labels.set(key, label);
      }
    }
  }

  return labels;
}

function enrichNode(node: GraphNode, label: NodeLabel | undefined): GraphNode {
  if (!label) {
    return node;
  }

  return {
    ...node,
    label: node.label ?? label.label,
    tags: mergeTags(node.tags, label.tags ?? []),
    metadata: {
      ...node.metadata,
      label: {
        entity: label.entity,
        category: label.category,
        source: label.source,
        updatedAt: label.updatedAt,
      },
    },
  };
}

function buildNodeKey(node: GraphNode): string {
  return buildLabelKey(node.chainId, node.address, node.kind);
}

function buildLabelKey(
  chainId: number | undefined,
  address: string | undefined,
  nodeKind: GraphNodeKind | undefined,
): string {
  return `${nodeKind ?? "*"}:${chainId ?? "*"}:${address?.toLowerCase() ?? "*"}`;
}

function mergeTags(existing: string[] | undefined, additional: string[]): string[] {
  return Array.from(new Set([...(existing ?? []), ...additional]));
}

function isUsefulLabel(label: NodeLabel): boolean {
  const displayLabel = label.label.trim().toLowerCase();

  if (displayLabel && displayLabel !== "unknown" && displayLabel !== "known address") {
    return true;
  }

  return Boolean(label.entity || (label.category && label.category !== "unknown"));
}

function inferCategory(labels: string[] | undefined): LabelCategory | undefined {
  const values = new Set((labels ?? []).map(slugifyLabel));

  if (values.has("exchange") || values.has("cex")) {
    return "cex";
  }

  if (values.has("bridge")) {
    return "bridge";
  }

  if (values.has("dex")) {
    return "dex";
  }

  if (values.has("token") || values.has("stablecoin")) {
    return "token";
  }

  return values.size > 0 ? "unknown" : undefined;
}

function readDisplayLabel(record: Record<string, unknown>): string | undefined {
  for (const key of ["nametag", "name_tag", "label", "name", "display_name", "entity_name"]) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readEntityLabel(record: Record<string, unknown>): string | undefined {
  for (const key of ["entity", "entity_name", "owner", "project", "organization"]) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readCategory(record: Record<string, unknown>): LabelCategory | undefined {
  const category = record.category;

  if (typeof category !== "string") {
    return undefined;
  }

  return inferCategory([category]);
}

function readTags(record: Record<string, unknown>): string[] {
  const rawTags = record.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.filter((tag): tag is string => typeof tag === "string")
    : typeof rawTags === "string"
      ? rawTags.split(/[\s,]+/)
      : [];

  return tags.map(slugifyLabel).filter(Boolean);
}

function slugifyLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
