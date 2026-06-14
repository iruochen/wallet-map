import type { SupportedAnalysisChain } from "../../app/chains";

export interface EvidenceEvent {
  type: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  from?: string;
  to?: string;
  contract?: string;
  methodId?: string;
  amount?: string;
  asset?: {
    kind: string;
    symbol?: string;
    contract?: string;
    decimals?: number;
    tokenId?: string;
  };
  transferScope?: string;
}

export interface EvidenceItem {
  eventId: string;
  txHash?: string;
  summary: string;
  event?: EvidenceEvent;
}

export interface GraphNode {
  id: string;
  kind: "wallet" | "contract" | "entity" | "asset";
  address?: string;
  chainId?: number;
  label?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  kind:
    | "native_transfer"
    | "token_transfer"
    | "nft_transfer"
    | "contract_interaction"
    | "shared_counterparty"
    | "temporal_similarity"
    | "bridge_route";
  source: string;
  target: string;
  weight?: number;
  evidenceEventIds: string[];
  metadata?: {
    chainId?: number;
    txHash?: string;
    transactions?: Array<{
      txHash: string;
      timestamp: string;
      type: string;
    }>;
    amount?: string;
    methodId?: string;
    txCount?: number;
    asset?: {
      kind?: string;
      symbol?: string;
      contract?: string;
      decimals?: number;
      tokenId?: string;
    };
  };
}

export interface GraphViewNode extends GraphNode {
  role: "watched" | "observed" | "contract" | "entity";
  label: string;
  shortLabel: string;
  degree: number;
  tags: string[];
  metrics: {
    degree: number;
    incomingCount: number;
    outgoingCount: number;
    findingCount: number;
  };
  visual: {
    size: number;
    colorToken: "wallet-watched" | "wallet-observed" | "contract" | "entity";
    icon: "wallet" | "contract" | "entity";
  };
}

export interface GraphViewEdge extends GraphEdge {
  weight: number;
  direction: "directed" | "undirected";
  label: string;
  findingIds: string[];
  metrics: {
    eventCount: number;
  };
}

export interface GraphViewModel {
  schemaVersion: "1.0";
  generatedAt: string;
  summary: {
    nodeCount: number;
    edgeCount: number;
    visibleNodeCount: number;
    visibleEdgeCount: number;
    truncated: boolean;
  };
  totalNodes: number;
  totalEdges: number;
  nodesTruncated: boolean;
  edgesTruncated: boolean;
  defaultChainId: number;
  availableChainIds: number[];
  walletFilters: Array<{
    address: string;
    nodeIds: string[];
    label: string;
  }>;
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
}

export interface AnalysisResponse {
  mode: "fixture" | "live";
  source: string;
  sourceLabel?: string;
  meta: {
    chainId: number;
    chainIds?: number[];
    chainName: string;
    requestedMode: "auto" | "fixture" | "live";
    resolvedMode: "fixture" | "live";
    dataProvider?: "auto" | "nodereal" | "etherscan" | "solscan";
    watchedAddressCount: number;
    eventCount: number;
    graphWalletCount: number;
    graphContractCount: number;
    fallbackReason?: string;
    warnings?: string[];
    fetchedAt: string;
  };
  score: {
    score: number;
    confidence: "low" | "medium" | "high";
    dimensions: {
      funding: number;
      destination: number;
      contract: number;
      temporal: number;
      asset: number;
    };
    topSignals: string[];
    reasons: string[];
    counterEvidence: string[];
  };
  summary: {
    verdict: "none" | "weak" | "medium" | "strong";
    headline: string;
    narrative: string;
    pairInsights: Array<{
      id: string;
      wallets: string[];
      labels: string[];
      strength: "weak" | "medium" | "strong";
      score: number;
      confidence: "low" | "medium" | "high";
      signalCount: number;
      reasons: string[];
      chainIds: number[];
    }>;
    signalHighlights: Array<{
      analyzerId: string;
      title: string;
      count: number;
    }>;
  };
  graph: {
    totalNodes: number;
    totalEdges: number;
    nodesTruncated: boolean;
    edgesTruncated: boolean;
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  graphView?: GraphViewModel;
  findings: Array<{
    id: string;
    analyzerId: string;
    title: string;
    description: string;
    severity: string;
    confidence: string;
    scoreImpact: number;
    evidenceTotal: number;
    evidenceTruncated: boolean;
    evidence: EvidenceItem[];
  }>;
}

export interface AnalysisJobProgress {
  phase: "fetch" | "graph" | "labels" | "analysis" | null;
  completedPhases: Array<"fetch" | "graph" | "labels" | "analysis">;
}

export interface AnalysisJobStartResponse {
  jobId: string;
}

export interface AnalysisJobPollResponse {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: AnalysisJobProgress;
  percent: number;
  createdAt?: string;
  startedAt?: string;
  error?: string;
  result?: AnalysisResponse;
}

export interface AnonymousAnalysisQuota {
  limit: number;
  used: number;
  remaining: number;
}

export interface AnalysisWorkbenchProps {
  liveConfigured: boolean;
  supportedChains: SupportedAnalysisChain[];
  initialAddresses?: string;
  anonymousAnalysisQuota?: AnonymousAnalysisQuota | null;
}
