"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { useMemo, useState } from "react";
import {
  buildExplorerAddressUrl,
  buildExplorerTokenUrl,
  buildExplorerTxUrl,
  getSupportedAnalysisChain,
} from "./chains";
import {
  formatAmount,
  formatEdgeKindLabel,
  shortenAddress,
  shortenTxHash,
} from "./format";

export interface GraphExplorerNode {
  id: string;
  kind: "wallet" | "contract" | "entity" | "asset";
  address?: string;
  chainId?: number;
  label?: string;
  tags?: string[];
}

export interface GraphExplorerEdge {
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
    amount?: string;
    methodId?: string;
    asset?: {
      kind?: string;
      symbol?: string;
      contract?: string;
      decimals?: number;
      tokenId?: string;
    };
  };
}

interface GraphExplorerProps {
  chainId: number;
  nodes: GraphExplorerNode[];
  edges: GraphExplorerEdge[];
  totalNodes: number;
  totalEdges: number;
  truncated: boolean;
}

type WalletRole = "watched" | "observed";

interface WalletNodeData extends Record<string, unknown> {
  kind: "wallet";
  role: WalletRole;
  address: string;
  chainId: number;
  shortLabel: string;
  href?: string;
  metrics: NodeMetrics;
}

interface ContractNodeData extends Record<string, unknown> {
  kind: "contract";
  address: string;
  chainId: number;
  shortLabel: string;
  href?: string;
  metrics: NodeMetrics;
}

interface OtherNodeData extends Record<string, unknown> {
  kind: "entity" | "asset";
  shortLabel: string;
  metrics: NodeMetrics;
}

type GraphNodeData = WalletNodeData | ContractNodeData | OtherNodeData;

interface NodeMetrics {
  incoming: number;
  outgoing: number;
  edges: number;
}

const edgeColorByKind: Record<GraphExplorerEdge["kind"], string> = {
  native_transfer: "#1c6b3d",
  token_transfer: "#2b3da7",
  nft_transfer: "#6b2391",
  contract_interaction: "#7a5202",
  shared_counterparty: "#94391a",
  temporal_similarity: "#3a3a3a",
  bridge_route: "#1d5295",
};

export function GraphExplorer({
  chainId,
  nodes,
  edges,
  totalNodes,
  totalEdges,
  truncated,
}: GraphExplorerProps) {
  const allKinds = useMemo(() => {
    const present = new Set<GraphExplorerEdge["kind"]>();
    for (const edge of edges) {
      present.add(edge.kind);
    }
    return Array.from(present);
  }, [edges]);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());

  function toggleKind(kind: string) {
    setHiddenKinds((current) => {
      const next = new Set(current);

      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }

      return next;
    });
  }

  const flow = useMemo(
    () => buildFlow({ chainId, nodes, edges, hiddenKinds }),
    [chainId, nodes, edges, hiddenKinds],
  );

  if (nodes.length === 0) {
    return (
      <div className="emptyStateBlock">
        <strong>暂无节点</strong>
        <p>当前数据源没有可视化的节点。</p>
      </div>
    );
  }

  return (
    <div className="graphExplorer">
      <div className="graphLegend" aria-label="Edge kind filter">
        {allKinds.map((kind) => {
          const hidden = hiddenKinds.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`graphLegendItem ${hidden ? "graphLegendItemHidden" : ""}`}
              style={{ "--legend-color": edgeColorByKind[kind] } as React.CSSProperties}
              aria-pressed={!hidden}
              title={hidden ? "点击重新显示" : "点击隐藏此类边"}
            >
              <span className="graphLegendSwatch" aria-hidden="true" />
              {formatEdgeKindLabel(kind)}
            </button>
          );
        })}
        <div className="graphLegendSummary">
          {truncated ? "已截断预览" : null}
          <span>
            {nodes.length} 节点 · {flow.visibleEdgeCount}/{totalEdges} 边
          </span>
        </div>
      </div>
      <div className="graphCanvas" role="region" aria-label="Relationship graph canvas">
        <ReactFlow
          nodes={flow.flowNodes}
          edges={flow.flowEdges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} color="#dce2d8" />
          <MiniMap pannable zoomable className="graphMiniMap" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {totalNodes > 0 ? (
        <p className="graphFootnote">
          {truncated
            ? `当前画布展示前 ${nodes.length} / ${totalNodes} 节点。`
            : `共 ${nodes.length} 节点，${totalEdges} 边。`}
        </p>
      ) : null}
    </div>
  );
}

interface BuildFlowInput {
  chainId: number;
  nodes: GraphExplorerNode[];
  edges: GraphExplorerEdge[];
  hiddenKinds: Set<string>;
}

interface BuildFlowResult {
  flowNodes: Node<GraphNodeData>[];
  flowEdges: Edge[];
  visibleEdgeCount: number;
}

function buildFlow(input: BuildFlowInput): BuildFlowResult {
  const { chainId, nodes, edges, hiddenKinds } = input;
  const metricsByNodeId = new Map<string, NodeMetrics>();

  for (const node of nodes) {
    metricsByNodeId.set(node.id, { incoming: 0, outgoing: 0, edges: 0 });
  }

  for (const edge of edges) {
    const sourceMetrics = metricsByNodeId.get(edge.source);
    const targetMetrics = metricsByNodeId.get(edge.target);

    if (sourceMetrics) {
      sourceMetrics.outgoing += 1;
      sourceMetrics.edges += 1;
    }

    if (targetMetrics) {
      targetMetrics.incoming += 1;
      targetMetrics.edges += 1;
    }
  }

  const watched = nodes.filter(
    (node) => node.kind === "wallet" && (node.tags?.includes("watched") ?? false),
  );
  const observed = nodes.filter(
    (node) => node.kind === "wallet" && !(node.tags?.includes("watched") ?? false),
  );
  const contracts = nodes.filter((node) => node.kind === "contract");
  const others = nodes.filter(
    (node) => node.kind !== "wallet" && node.kind !== "contract",
  );

  const columns: Array<{ list: GraphExplorerNode[]; x: number; kind: string }> = [
    { list: observed, x: -420, kind: "observed" },
    { list: watched, x: 0, kind: "watched" },
    { list: contracts, x: 420, kind: "contract" },
  ];

  if (others.length > 0) {
    columns.push({ list: others, x: 840, kind: "entity" });
  }

  const positions = new Map<string, { x: number; y: number }>();

  for (const column of columns) {
    const list = column.list;
    if (list.length === 0) {
      continue;
    }

    const verticalSpacing = 140;
    const totalHeight = (list.length - 1) * verticalSpacing;

    list.forEach((node, index) => {
      positions.set(node.id, {
        x: column.x,
        y: index * verticalSpacing - totalHeight / 2,
      });
    });
  }

  const flowNodes: Node<GraphNodeData>[] = nodes.map((node) => {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const metrics = metricsByNodeId.get(node.id) ?? { incoming: 0, outgoing: 0, edges: 0 };

    if (node.kind === "wallet") {
      const role: WalletRole = node.tags?.includes("watched") ? "watched" : "observed";
      const address = node.address ?? extractAddressFromId(node.id);
      const data: WalletNodeData = {
        kind: "wallet",
        role,
        address: address ?? node.id,
        chainId: node.chainId ?? chainId,
        shortLabel: address ? shortenAddress(address) : node.id,
        href: address ? buildExplorerAddressUrl(node.chainId ?? chainId, address) : undefined,
        metrics,
      };

      return {
        id: node.id,
        type: "wallet",
        position,
        data,
      };
    }

    if (node.kind === "contract") {
      const address = node.address ?? extractAddressFromId(node.id);
      const data: ContractNodeData = {
        kind: "contract",
        address: address ?? node.id,
        chainId: node.chainId ?? chainId,
        shortLabel: address ? shortenAddress(address) : node.id,
        href: address ? buildExplorerAddressUrl(node.chainId ?? chainId, address) : undefined,
        metrics,
      };

      return {
        id: node.id,
        type: "contract",
        position,
        data,
      };
    }

    const data: OtherNodeData = {
      kind: node.kind,
      shortLabel: node.label ?? node.id,
      metrics,
    };

    return {
      id: node.id,
      type: "wallet",
      position,
      data,
    };
  });

  const visibleEdges = edges.filter((edge) => !hiddenKinds.has(edge.kind));
  const flowEdges: Edge[] = visibleEdges.map((edge) => {
    const color = edgeColorByKind[edge.kind] ?? "#4c5b51";
    const label = buildEdgeLabel(edge, chainId);
    const tooltip = buildEdgeTooltip(edge, chainId);

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      label,
      labelStyle: { fill: color, fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: "rgba(255,255,255,0.9)", strokeOpacity: 0 },
      labelBgPadding: [3, 4],
      labelBgBorderRadius: 4,
      style: {
        stroke: color,
        strokeWidth: edge.kind === "shared_counterparty" ? 1.5 : 2,
        strokeDasharray: edge.kind === "shared_counterparty" ? "4 3" : undefined,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
      },
      data: {
        kind: edge.kind,
        tooltip,
        txHash: edge.metadata?.txHash,
        chainId: edge.metadata?.chainId ?? chainId,
      },
    };
  });

  return {
    flowNodes,
    flowEdges,
    visibleEdgeCount: visibleEdges.length,
  };
}

function buildEdgeLabel(edge: GraphExplorerEdge, fallbackChainId: number): string {
  const kindLabel = formatEdgeKindLabel(edge.kind);
  const eventChainId = edge.metadata?.chainId ?? fallbackChainId;
  const chain = getSupportedAnalysisChain(eventChainId);
  const asset = edge.metadata?.asset;
  const isNative = asset?.kind === "native";
  const decimals = isNative ? chain?.nativeDecimals ?? 18 : asset?.decimals;
  const canRenderAmount =
    edge.metadata?.amount !== undefined &&
    edge.metadata.amount !== "" &&
    (isNative || asset?.decimals !== undefined);
  const amount = canRenderAmount ? formatAmount(edge.metadata?.amount, decimals) : undefined;
  const symbol = asset?.symbol ?? (isNative ? chain?.nativeSymbol : undefined);

  if (amount && symbol) {
    return `${kindLabel} · ${amount} ${symbol}`;
  }

  if (edge.kind === "contract_interaction" && edge.metadata?.methodId) {
    return `${kindLabel} · ${edge.metadata.methodId}`;
  }

  return kindLabel;
}

function buildEdgeTooltip(edge: GraphExplorerEdge, fallbackChainId: number): string {
  const eventChainId = edge.metadata?.chainId ?? fallbackChainId;
  const txHash = edge.metadata?.txHash;
  const explorerUrl = txHash ? buildExplorerTxUrl(eventChainId, txHash) : undefined;
  const lines: string[] = [];

  lines.push(formatEdgeKindLabel(edge.kind));

  if (txHash) {
    lines.push(`tx ${shortenTxHash(txHash)}`);
  }

  if (explorerUrl) {
    lines.push(explorerUrl);
  }

  return lines.join("\n");
}

function extractAddressFromId(id: string): string | undefined {
  const parts = id.split(":");
  const candidate = parts[parts.length - 1];

  return /^0x[a-fA-F0-9]{40}$/.test(candidate) ? candidate : undefined;
}

function WalletNode({ data }: NodeProps<Node<WalletNodeData>>) {
  const isWatched = data.role === "watched";

  return (
    <div className={`graphNode graphNode-wallet graphNode-${data.role}`}>
      <Handle type="target" position={Position.Left} />
      <div className="graphNodeHeader">
        <span className="graphNodeTag">{isWatched ? "WATCHED" : "OBSERVED"}</span>
        {data.metrics ? (
          <span className="graphNodeMetric" title={`${data.metrics.incoming} in / ${data.metrics.outgoing} out`}>
            {data.metrics.edges}
          </span>
        ) : null}
      </div>
      <div className="graphNodeBody">
        <span className="graphNodeIcon" aria-hidden="true">
          {isWatched ? "★" : "○"}
        </span>
        {data.href ? (
          <a
            href={data.href}
            target="_blank"
            rel="noreferrer noopener"
            className="graphNodeLink"
            title={data.address}
            onClick={(event) => event.stopPropagation()}
          >
            {data.shortLabel}
          </a>
        ) : (
          <span className="graphNodeLink" title={data.address}>
            {data.shortLabel}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function ContractNode({ data }: NodeProps<Node<ContractNodeData>>) {
  const explorerToken = buildExplorerTokenUrl(data.chainId, data.address);

  return (
    <div className="graphNode graphNode-contract">
      <Handle type="target" position={Position.Left} />
      <div className="graphNodeHeader">
        <span className="graphNodeTag">CONTRACT</span>
        {data.metrics ? (
          <span className="graphNodeMetric">{data.metrics.edges}</span>
        ) : null}
      </div>
      <div className="graphNodeBody">
        <span className="graphNodeIcon" aria-hidden="true">
          ⬢
        </span>
        {data.href ? (
          <a
            href={data.href}
            target="_blank"
            rel="noreferrer noopener"
            className="graphNodeLink"
            title={data.address}
            onClick={(event) => event.stopPropagation()}
          >
            {data.shortLabel}
          </a>
        ) : (
          <span className="graphNodeLink" title={data.address}>
            {data.shortLabel}
          </span>
        )}
      </div>
      {explorerToken ? (
        <a
          href={explorerToken}
          target="_blank"
          rel="noreferrer noopener"
          className="graphNodeSubLink"
          onClick={(event) => event.stopPropagation()}
        >
          token ↗
        </a>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  wallet: WalletNode,
  contract: ContractNode,
};
