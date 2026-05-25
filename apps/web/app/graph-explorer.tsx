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
  const denseGraph = nodes.length > 24;
  const [showEdgeLabels, setShowEdgeLabels] = useState(!denseGraph);

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
    () => buildFlow({ chainId, nodes, edges, hiddenKinds, showEdgeLabels }),
    [chainId, nodes, edges, hiddenKinds, showEdgeLabels],
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
        <button
          type="button"
          className={`graphLegendToggle ${showEdgeLabels ? "graphLegendTogglePressed" : ""}`}
          onClick={() => setShowEdgeLabels((value) => !value)}
          aria-pressed={showEdgeLabels}
          title={showEdgeLabels ? "隐藏边标签" : "显示边标签"}
        >
          {showEdgeLabels ? "边标签：开" : "边标签：关"}
        </button>
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
  showEdgeLabels: boolean;
}

interface BuildFlowResult {
  flowNodes: Node<GraphNodeData>[];
  flowEdges: Edge[];
  visibleEdgeCount: number;
}

function buildFlow(input: BuildFlowInput): BuildFlowResult {
  const { chainId, nodes, edges, hiddenKinds, showEdgeLabels } = input;
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

  const positions = layoutColumns({ watched, observed, contracts, others });

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
    const label = showEdgeLabels ? buildEdgeLabel(edge, chainId) : undefined;
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
        opacity: 0.85,
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

interface LayoutInput {
  watched: GraphExplorerNode[];
  observed: GraphExplorerNode[];
  contracts: GraphExplorerNode[];
  others: GraphExplorerNode[];
}

function layoutColumns(input: LayoutInput): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const watchedColumnX = 0;
  const watchedSpacing = 160;
  const sideColumnWidth = 280;
  const sideRowHeight = 100;
  const sideMaxRows = 14;
  const watchedGap = 360;

  layoutCentralColumn(input.watched, watchedColumnX, watchedSpacing, positions);

  const observedColumns = Math.max(1, Math.ceil(input.observed.length / sideMaxRows));
  const observedStartX = -watchedGap - (observedColumns - 1) * sideColumnWidth;
  layoutSideGrid({
    nodes: input.observed,
    startX: observedStartX,
    columnWidth: sideColumnWidth,
    rowHeight: sideRowHeight,
    maxRows: sideMaxRows,
    positions,
  });

  layoutSideGrid({
    nodes: input.contracts,
    startX: watchedGap,
    columnWidth: sideColumnWidth,
    rowHeight: sideRowHeight,
    maxRows: sideMaxRows,
    positions,
  });

  if (input.others.length > 0) {
    const contractColumns = Math.max(1, Math.ceil(input.contracts.length / sideMaxRows));
    const othersStartX = watchedGap + contractColumns * sideColumnWidth + 40;
    layoutSideGrid({
      nodes: input.others,
      startX: othersStartX,
      columnWidth: sideColumnWidth,
      rowHeight: sideRowHeight,
      maxRows: sideMaxRows,
      positions,
    });
  }

  return positions;
}

function layoutCentralColumn(
  nodes: GraphExplorerNode[],
  x: number,
  verticalSpacing: number,
  positions: Map<string, { x: number; y: number }>,
): void {
  if (nodes.length === 0) {
    return;
  }

  const totalHeight = (nodes.length - 1) * verticalSpacing;

  nodes.forEach((node, index) => {
    positions.set(node.id, {
      x,
      y: index * verticalSpacing - totalHeight / 2,
    });
  });
}

interface SideGridInput {
  nodes: GraphExplorerNode[];
  startX: number;
  columnWidth: number;
  rowHeight: number;
  maxRows: number;
  positions: Map<string, { x: number; y: number }>;
}

function layoutSideGrid(input: SideGridInput): void {
  const { nodes, startX, columnWidth, rowHeight, maxRows, positions } = input;

  if (nodes.length === 0) {
    return;
  }

  const columns = Math.max(1, Math.ceil(nodes.length / maxRows));
  const rowsPerColumn = Math.ceil(nodes.length / columns);
  const totalHeight = (rowsPerColumn - 1) * rowHeight;

  nodes.forEach((node, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const row = index % rowsPerColumn;
    positions.set(node.id, {
      x: startX + column * columnWidth,
      y: row * rowHeight - totalHeight / 2,
    });
  });
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
