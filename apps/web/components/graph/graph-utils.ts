import type { ElementDefinition } from "cytoscape";
import {
  buildExplorerAddressUrl,
  buildExplorerTxUrl,
  getSupportedAnalysisChain,
} from "../../app/chains";
import {
  formatAmount,
  formatMethodSelectorLabel,
  shortenAddress,
} from "../../app/format";
import type { GraphExplorerEdge, GraphExplorerNode, ResolvedNode } from "./graph-types";

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
    const fallbackLabel = node.label ?? (node.address ? shortenAddress(node.address) : node.id);
    return {
      ...node,
      role,
      degree: degreeMap.get(node.id) ?? 0,
      shortLabel: fallbackLabel,
    };
  });
}

export function describeNodeRole(role: ResolvedNode["role"]): string {
  if (role === "watched") {
    return "这是本次输入的钱包节点，系统会围绕它来判断是否存在关联。";
  }

  if (role === "observed") {
    return "这是在链上行为中被命中的外部地址，用来解释 watched 钱包之间的关联路径。";
  }

  if (role === "contract") {
    return "这是被多个钱包共同触达的合约节点，可用于辅助判断协同行为。";
  }

  return "这是图中的辅助实体节点。";
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

export function describeEdgeKind(kind: GraphExplorerEdge["kind"]): string {
  switch (kind) {
    case "native_transfer":
      return "这条边代表原生币直接转账";
    case "token_transfer":
      return "这条边代表代币转账";
    case "nft_transfer":
      return "这条边代表 NFT 转移";
    case "contract_interaction":
      return "这条边代表钱包对同一合约的调用";
    case "shared_counterparty":
      return "这条边代表两个钱包共享同一个外部对手地址";
    case "bridge_route":
      return "这条边代表跨链桥接路径";
    default:
      return "这条边代表时间或行为上的弱关联";
  }
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
  const chainIds = new Set<number>();

  for (const node of nodes) {
    chainIds.add(node.chainId ?? fallbackChainId);
  }

  for (const edge of edges) {
    chainIds.add(edge.metadata?.chainId ?? fallbackChainId);
  }

  return chainIds.size > 1;
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
