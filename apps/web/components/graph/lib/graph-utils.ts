import type { ElementDefinition } from "cytoscape";
import {
  buildExplorerAddressUrl,
  buildExplorerTxUrl,
  getSupportedAnalysisChain,
} from "../../../app/chains";
import {
  formatAmount,
  formatMethodSelectorLabel,
  shortenAddress,
} from "../../../app/format";
import type { I18nKey } from "../../i18n/i18n-provider";
import type { GraphExplorerEdge, GraphExplorerNode, ResolvedNode } from "./graph-types";

type TranslateFn = (key: I18nKey, params?: Record<string, string | number>) => string;

export const edgePalette: Record<GraphExplorerEdge["kind"], string> = {
  native_transfer: "#2f7d4f",
  token_transfer: "#2e44b8",
  nft_transfer: "#7a2da6",
  contract_interaction: "#b07410",
  shared_counterparty: "#a44320",
  temporal_similarity: "#525a52",
  bridge_route: "#1c66b4",
};

export function buildElements(input: {
  chainId: number;
  resolvedNodes: ResolvedNode[];
  edges: GraphExplorerEdge[];
  showEdgeLabels: boolean;
  denseGraph: boolean;
}): ElementDefinition[] {
  const { chainId, resolvedNodes, edges, showEdgeLabels, denseGraph } = input;
  const elements: ElementDefinition[] = [];
  const multiChain = hasMultipleChains(resolvedNodes, edges, chainId);

  for (const node of resolvedNodes) {
    elements.push({
      group: "nodes",
      data: {
        id: node.id,
        role: node.role,
        kind: node.kind,
        label: multiChain ? `${formatChainShortName(node.chainId ?? chainId)} · ${node.shortLabel}` : node.shortLabel,
        size: nodeSizeForDegree(node.degree, node.role),
        href: node.address ? buildExplorerAddressUrl(node.chainId ?? chainId, node.address) : undefined,
        degree: node.degree,
      },
      classes: `node-${node.role}${denseGraph ? " dense" : ""}`,
    });
  }

  for (const edge of edges) {
    elements.push({
      group: "edges",
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
        color: edgePalette[edge.kind] ?? "#525a52",
        label: buildEdgeLabel(edge, chainId, showEdgeLabels, multiChain),
        weight: Math.max(1.2, Math.log2((edge.evidenceEventIds?.length ?? 1) + 1) + 0.8),
        curveDistance: getParallelEdgeCurveDistance(edge, edges),
        labelOffset: getParallelEdgeLabelOffset(edge, edges),
        txHref: edge.metadata?.txHash
          ? buildExplorerTxUrl(edge.metadata?.chainId ?? chainId, edge.metadata.txHash)
          : undefined,
        dashed: edge.kind === "shared_counterparty",
      },
      classes: edge.kind === "shared_counterparty" ? "edge-dashed" : undefined,
    });
  }

  return elements;
}

export function resolveNodes(
  nodes: GraphExplorerNode[],
  edges: GraphExplorerEdge[],
): ResolvedNode[] {
  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
  }

  return nodes.map((node) => {
    const role = resolveNodeRole(node);
    const fallbackLabel = resolveNodeDisplayLabel(node);
    return {
      ...node,
      role,
      degree: degreeMap.get(node.id) ?? 0,
      shortLabel: fallbackLabel,
    };
  });
}

function resolveNodeDisplayLabel(node: GraphExplorerNode): string {
  if (node.shortLabel) {
    return node.shortLabel;
  }

  if (node.address && (!node.label || node.label.toLowerCase() === node.address.toLowerCase())) {
    return shortenAddress(node.address);
  }

  return node.label ?? (node.address ? shortenAddress(node.address) : node.id);
}

export function describeNodeRole(t: TranslateFn, role: ResolvedNode["role"]): string {
  const keyMap: Record<ResolvedNode["role"], I18nKey> = {
    watched: "graph.nodeRole.watched",
    observed: "graph.nodeRole.observed",
    contract: "graph.nodeRole.contract",
    entity: "graph.nodeRole.entity",
  };

  return t(keyMap[role]);
}

export function formatNodeRoleLabel(role: ResolvedNode["role"]): string {
  if (role === "watched") {
    return "WATCHED";
  }

  if (role === "observed") {
    return "OBSERVED";
  }

  if (role === "contract") {
    return "CONTRACT";
  }

  return "ENTITY";
}

export function describeEdgeKind(t: TranslateFn, kind: GraphExplorerEdge["kind"]): string {
  const keyMap: Record<GraphExplorerEdge["kind"], I18nKey> = {
    native_transfer: "graph.edgeKind.nativeTransfer",
    token_transfer: "graph.edgeKind.tokenTransfer",
    nft_transfer: "graph.edgeKind.nftTransfer",
    contract_interaction: "graph.edgeKind.contractInteraction",
    shared_counterparty: "graph.edgeKind.sharedCounterparty",
    bridge_route: "graph.edgeKind.bridgeRoute",
    temporal_similarity: "graph.edgeKind.temporalSimilarity",
  };

  return t(keyMap[kind]);
}

export function buildEdgeLabel(
  edge: GraphExplorerEdge,
  chainId: number,
  showEdgeLabels: boolean,
  includeChain: boolean,
): string {
  if (!showEdgeLabels) {
    return "";
  }

  const edgeChainId = edge.metadata?.chainId ?? chainId;
  const eventChain = getSupportedAnalysisChain(edgeChainId);
  const isNativeAsset = edge.metadata?.asset?.kind === "native";
  const amountDecimals = isNativeAsset
    ? eventChain?.nativeDecimals ?? 18
    : edge.metadata?.asset?.decimals;
  const canRenderAmount =
    edge.metadata?.amount !== undefined &&
    edge.metadata.amount !== "" &&
    (isNativeAsset || edge.metadata?.asset?.decimals !== undefined);
  const amountFormatted = canRenderAmount ? formatAmount(edge.metadata?.amount, amountDecimals) : undefined;
  const amountSymbol = edge.metadata?.asset?.symbol ?? (isNativeAsset ? eventChain?.nativeSymbol : undefined);

  const labelPieces: string[] = [];
  if (includeChain) {
    labelPieces.push(formatChainShortName(edgeChainId));
  }

  if (amountFormatted) {
    labelPieces.push(amountSymbol ? `${amountFormatted} ${amountSymbol}` : amountFormatted);
  } else if (edge.metadata?.methodId) {
    labelPieces.push(formatMethodSelectorLabel(edge.metadata.methodId) ?? edge.metadata.methodId);
  }

  if ((edge.metadata?.txCount ?? 1) > 1) {
    labelPieces.push(`${edge.metadata?.txCount} tx`);
  }

  return labelPieces.join(" · ");
}

export function hasMultipleChains(
  nodes: ResolvedNode[],
  edges: GraphExplorerEdge[],
  fallbackChainId: number,
): boolean {
  return collectGraphChainIds(nodes, edges, fallbackChainId).length > 1;
}

export function collectGraphChainIds(
  nodes: Array<Pick<GraphExplorerNode, "chainId">>,
  edges: GraphExplorerEdge[],
  fallbackChainId: number,
): number[] {
  const chainIds = new Set<number>();

  for (const node of nodes) {
    if (node.chainId !== undefined) {
      chainIds.add(node.chainId);
      continue;
    }

    if (fallbackChainId !== 0) {
      chainIds.add(fallbackChainId);
    }
  }

  for (const edge of edges) {
    chainIds.add(edge.metadata?.chainId ?? (fallbackChainId !== 0 ? fallbackChainId : undefined) ?? 0);
  }

  return Array.from(chainIds)
    .filter((chainId) => chainId > 0)
    .sort((left, right) => formatChainShortName(left).localeCompare(formatChainShortName(right)));
}

export function filterGraphByChain(input: {
  nodes: GraphExplorerNode[];
  edges: GraphExplorerEdge[];
  fallbackChainId: number;
  chainFilter: number | "all";
}): { nodes: GraphExplorerNode[]; edges: GraphExplorerEdge[] } {
  const { nodes, edges, fallbackChainId, chainFilter } = input;

  if (chainFilter === "all") {
    return { nodes, edges };
  }

  const filteredEdges = edges.filter(
    (edge) => resolveGraphChainId(edge.metadata?.chainId, fallbackChainId) === chainFilter,
  );
  const nodeIds = new Set<string>();

  for (const edge of filteredEdges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  return {
    nodes: nodes.filter((node) => nodeIds.has(node.id)),
    edges: filteredEdges,
  };
}

export interface WatchedWalletOption {
  address: string;
  nodeIds: string[];
}

export function collectWatchedWalletOptions(nodes: GraphExplorerNode[]): WatchedWalletOption[] {
  const groups = new Map<string, string[]>();

  for (const node of nodes) {
    if (node.kind !== "wallet" || !node.tags?.includes("watched") || !node.address) {
      continue;
    }

    const key = node.address.toLowerCase();
    const nodeIds = groups.get(key) ?? [];
    nodeIds.push(node.id);
    groups.set(key, nodeIds);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([address, nodeIds]) => ({ address, nodeIds }));
}

export function filterGraphByWallet(input: {
  nodes: GraphExplorerNode[];
  edges: GraphExplorerEdge[];
  walletFilter: string | "all";
  watchedWalletOptions: WatchedWalletOption[];
}): { nodes: GraphExplorerNode[]; edges: GraphExplorerEdge[] } {
  const { nodes, edges, walletFilter, watchedWalletOptions } = input;

  if (walletFilter === "all") {
    return { nodes, edges };
  }

  const option = watchedWalletOptions.find(
    (entry) => entry.address.toLowerCase() === walletFilter.toLowerCase(),
  );

  if (!option) {
    return { nodes: [], edges: [] };
  }

  const focusNodeIds = new Set(option.nodeIds);
  const filteredEdges = edges.filter(
    (edge) => focusNodeIds.has(edge.source) || focusNodeIds.has(edge.target),
  );
  const nodeIds = new Set<string>();

  for (const edge of filteredEdges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  return {
    nodes: nodes.filter((node) => nodeIds.has(node.id)),
    edges: filteredEdges,
  };
}

export function resolveGraphChainId(chainId: number | undefined, fallbackChainId: number): number {
  if (chainId !== undefined && chainId > 0) {
    return chainId;
  }

  return fallbackChainId > 0 ? fallbackChainId : chainId ?? 0;
}

export function formatChainShortName(chainId: number): string {
  return getSupportedAnalysisChain(chainId)?.shortName ?? `#${chainId}`;
}

function getParallelEdgeCurveDistance(edge: GraphExplorerEdge, edges: GraphExplorerEdge[]): number {
  const siblings = edges
    .filter((candidate) => candidate.source === edge.source && candidate.target === edge.target)
    .sort((left, right) => left.id.localeCompare(right.id));
  const index = siblings.findIndex((candidate) => candidate.id === edge.id);

  if (index === -1 || siblings.length <= 1) {
    return 0;
  }

  const offset = index - (siblings.length - 1) / 2;
  return offset * 34;
}

function getParallelEdgeLabelOffset(edge: GraphExplorerEdge, edges: GraphExplorerEdge[]): number {
  const curveDistance = getParallelEdgeCurveDistance(edge, edges);

  if (curveDistance === 0) {
    return 10;
  }

  return Math.max(12, Math.abs(curveDistance) * 0.45);
}

function resolveNodeRole(node: GraphExplorerNode): ResolvedNode["role"] {
  if (node.kind === "contract") {
    return "contract";
  }
  if (node.kind === "wallet") {
    return node.tags?.includes("watched") ? "watched" : "observed";
  }
  return "entity";
}

function nodeSizeForDegree(degree: number, role: ResolvedNode["role"]): number {
  const base = role === "watched" ? 48 : role === "observed" ? 28 : role === "contract" ? 26 : 24;
  const bonus = Math.min(Math.log2(degree + 1) * 4, 16);
  return base + bonus;
}
