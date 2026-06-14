import type { Finding, GraphEdge, GraphNode, RelationshipGraph } from "@wallet-map/core";

export interface AnalysisPresentationSummary {
  verdict: "none" | "weak" | "medium" | "strong";
  headline: string;
  narrative: string;
  pairInsights: WalletPairInsight[];
  signalHighlights: SignalHighlight[];
}

export interface WalletPairInsight {
  id: string;
  wallets: string[];
  labels: string[];
  strength: "weak" | "medium" | "strong";
  score: number;
  confidence: "low" | "medium" | "high";
  signalCount: number;
  reasons: string[];
  chainIds: number[];
}

export interface SignalHighlight {
  analyzerId: string;
  title: string;
  count: number;
}

interface GraphSubset {
  graph: RelationshipGraph;
  relatedEdgeIds: Set<string>;
}

interface FindingWithMetadata extends Finding {
  metadata?: Finding["metadata"] & {
    edgeId?: string;
    edgeIds?: string[];
    source?: string;
    target?: string;
    watchedWalletNodeIds?: string[];
    contractNodeId?: string;
    counterpartyNodeId?: string;
  };
}

export function buildPresentationGraph(
  graph: RelationshipGraph,
  findings: Finding[],
): GraphSubset {
  const typedFindings = findings as FindingWithMetadata[];
  const relatedEdgeIds = new Set<string>();

  for (const finding of typedFindings) {
    if (finding.metadata?.edgeId) {
      relatedEdgeIds.add(finding.metadata.edgeId);
    }

    for (const edgeId of finding.metadata?.edgeIds ?? []) {
      relatedEdgeIds.add(edgeId);
    }
  }

  if (relatedEdgeIds.size === 0) {
    return {
      graph: {
        nodes: [],
        edges: [],
      },
      relatedEdgeIds,
    };
  }

  const edges = aggregateEdges(graph.edges.filter((edge) => relatedEdgeIds.has(edge.id)));
  const nodeIds = new Set<string>();

  for (const edge of edges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));

  return {
    graph: {
      nodes,
      edges,
    },
    relatedEdgeIds,
  };
}

function aggregateEdges(edges: GraphEdge[]): GraphEdge[] {
  const grouped = new Map<string, GraphEdge>();

  for (const edge of edges) {
    const metadata = edge.metadata ?? {};
    const key = [
      edge.kind,
      edge.source,
      edge.target,
      typeof metadata.methodId === "string" ? metadata.methodId : "",
      typeof metadata.asset === "object" && metadata.asset && "contract" in metadata.asset
        ? String((metadata.asset as { contract?: string }).contract ?? "")
        : "",
    ].join("|");
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, {
        ...edge,
        evidenceEventIds: [...edge.evidenceEventIds],
        metadata: {
          ...metadata,
          txCount: edge.evidenceEventIds.length || 1,
        },
      });
      continue;
    }

    current.weight += edge.weight;
    current.evidenceEventIds = Array.from(
      new Set([...current.evidenceEventIds, ...edge.evidenceEventIds]),
    );
    current.metadata = {
      ...current.metadata,
      txCount: Number((current.metadata as { txCount?: number } | undefined)?.txCount ?? 1) + 1,
    };
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.source !== right.source) {
      return left.source.localeCompare(right.source);
    }

    if (left.target !== right.target) {
      return left.target.localeCompare(right.target);
    }

    return left.kind.localeCompare(right.kind);
  });
}

export function buildPresentationSummary(
  findings: Finding[],
  graph: RelationshipGraph,
): AnalysisPresentationSummary {
  const typedFindings = findings as FindingWithMetadata[];
  const nodeIndex = new Map(graph.nodes.map((node) => [node.id, node]));
  const pairMap = new Map<string, WalletPairInsight>();

  for (const finding of typedFindings) {
    const walletNodeIds = resolveWalletNodeIds(finding, nodeIndex);

    if (walletNodeIds.length < 2) {
      continue;
    }

    for (const pair of getWalletPairs(walletNodeIds)) {
      const pairId = pair.join("|");
      const labels = pair.map((nodeId) => formatWalletNode(nodeIndex.get(nodeId), nodeId));
      const current = pairMap.get(pairId) ?? {
        id: pairId,
        wallets: pair,
        labels,
        strength: "weak",
        score: 0,
        confidence: "low",
        signalCount: 0,
        reasons: [],
        chainIds: [],
      };

      current.score += finding.scoreImpact;
      current.signalCount += 1;
      current.confidence = maxConfidence(current.confidence, finding.confidence);

      if (!current.reasons.includes(finding.title)) {
        current.reasons.push(finding.title);
      }

      for (const chainId of collectFindingChainIds(finding, nodeIndex)) {
        if (!current.chainIds.includes(chainId)) {
          current.chainIds.push(chainId);
        }
      }

      current.strength = classifyStrength(current.score, current.confidence, current.reasons);
      pairMap.set(pairId, current);
    }
  }

  const pairInsights = Array.from(pairMap.values())
    .map((pair) => ({
      ...pair,
      chainIds: [...pair.chainIds].sort((left, right) => left - right),
    }))
    .sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return right.signalCount - left.signalCount;
  });

  const strongest = pairInsights[0];
  const verdict = strongest?.strength ?? "none";
  const headline = buildHeadline(verdict, pairInsights.length);
  const narrative = buildNarrative(verdict, pairInsights);
  const signalHighlights = buildSignalHighlights(typedFindings);

  return {
    verdict,
    headline,
    narrative,
    pairInsights,
    signalHighlights,
  };
}

function collectFindingChainIds(
  finding: FindingWithMetadata,
  nodeIndex: Map<string, GraphNode>,
): number[] {
  const chainIds = new Set<number>();
  const nodeIds = [
    ...(finding.metadata?.watchedWalletNodeIds ?? []),
    finding.metadata?.contractNodeId,
    finding.metadata?.counterpartyNodeId,
    finding.metadata?.source,
    finding.metadata?.target,
  ].filter((nodeId): nodeId is string => typeof nodeId === "string");

  for (const nodeId of nodeIds) {
    const chainId = nodeIndex.get(nodeId)?.chainId ?? extractChainIdFromNodeId(nodeId);
    if (typeof chainId === "number" && Number.isFinite(chainId)) {
      chainIds.add(chainId);
    }
  }

  return Array.from(chainIds);
}

function extractChainIdFromNodeId(nodeId: string): number | undefined {
  const match = /^(?:wallet|contract|entity|asset):(\d+):/.exec(nodeId);
  if (!match) {
    return undefined;
  }

  const chainId = Number(match[1]);
  return Number.isFinite(chainId) ? chainId : undefined;
}

function resolveWalletNodeIds(
  finding: FindingWithMetadata,
  nodeIndex: Map<string, GraphNode>,
): string[] {
  const explicit = finding.metadata?.watchedWalletNodeIds ?? [];

  if (explicit.length >= 2) {
    return Array.from(new Set(explicit)).sort();
  }

  const source = finding.metadata?.source;
  const target = finding.metadata?.target;

  if (source && target) {
    const resolved = [source, target].filter((nodeId) => nodeIndex.get(nodeId)?.kind === "wallet");

    if (resolved.length >= 2) {
      return Array.from(new Set(resolved)).sort();
    }
  }

  return [];
}

function getWalletPairs(walletNodeIds: string[]): string[][] {
  const pairs: string[][] = [];

  for (let leftIndex = 0; leftIndex < walletNodeIds.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < walletNodeIds.length; rightIndex += 1) {
      pairs.push([walletNodeIds[leftIndex]!, walletNodeIds[rightIndex]!]);
    }
  }

  return pairs;
}

function formatWalletNode(node: GraphNode | undefined, fallbackId: string): string {
  const address = node?.address ?? extractAddressFromNodeId(fallbackId);

  if (address.startsWith("0x") && address.length > 12) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  return address;
}

function extractAddressFromNodeId(nodeId: string): string {
  const match = /(0x[a-fA-F0-9]{40})/.exec(nodeId);
  return match?.[1] ?? nodeId;
}

function maxConfidence(
  current: "low" | "medium" | "high",
  next: "low" | "medium" | "high",
): "low" | "medium" | "high" {
  const order = {
    low: 0,
    medium: 1,
    high: 2,
  } as const;

  return order[next] > order[current] ? next : current;
}

function classifyStrength(
  score: number,
  confidence: "low" | "medium" | "high",
  reasons: string[],
): "weak" | "medium" | "strong" {
  if (reasons.includes("Direct transfer found") || (score >= 60 && confidence !== "low")) {
    return "strong";
  }

  if (score >= 28 || confidence === "high") {
    return "medium";
  }

  return "weak";
}

function buildHeadline(verdict: AnalysisPresentationSummary["verdict"], pairCount: number): string {
  if (verdict === "strong") {
    return `发现 ${pairCount} 组高价值关联，其中至少 1 组可判定为强关联。`;
  }

  if (verdict === "medium") {
    return `发现 ${pairCount} 组关联线索，整体以中等关联为主。`;
  }

  if (verdict === "weak") {
    return `发现 ${pairCount} 组弱关联线索，建议继续补充分析器和时间维度。`;
  }

  return "当前没有形成明确的钱包关联结论。";
}

function buildNarrative(
  verdict: AnalysisPresentationSummary["verdict"],
  pairInsights: WalletPairInsight[],
): string {
  if (pairInsights.length === 0) {
    return "现有分析器没有命中可归因为钱包关联的交易或共同交互。";
  }

  const lead = pairInsights[0]!;
  const pairLabel = lead.labels.join(" ↔ ");
  const reasons = lead.reasons.join("、");

  if (verdict === "strong") {
    return `${pairLabel} 命中了 ${reasons}，并且累计信号最强，当前可以优先视为重点关联钱包对。`;
  }

  if (verdict === "medium") {
    return `${pairLabel} 命中了 ${reasons}，已经形成可解释的关联，但还需要更多上下文来确认归属关系。`;
  }

  return `${pairLabel} 目前只命中了 ${reasons} 这类较弱信号，适合作为后续深挖的起点。`;
}

function buildSignalHighlights(findings: FindingWithMetadata[]): SignalHighlight[] {
  const counts = new Map<string, SignalHighlight>();

  for (const finding of findings) {
    const key = `${finding.analyzerId}:${finding.title}`;
    const current = counts.get(key) ?? {
      analyzerId: finding.analyzerId,
      title: finding.title,
      count: 0,
    };
    current.count += 1;
    counts.set(key, current);
  }

  return Array.from(counts.values()).sort((left, right) => right.count - left.count);
}
