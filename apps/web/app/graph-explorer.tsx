"use client";

import cytoscape, {
  type Core,
  type ElementDefinition,
  type EventObject,
  type NodeSingular,
  type EdgeSingular,
} from "cytoscape";
import fcose from "cytoscape-fcose";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Minus,
  Plus,
  ScanSearch,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildExplorerAddressUrl,
  buildExplorerTokenUrl,
  buildExplorerTxUrl,
  getSupportedAnalysisChain,
} from "./chains";
import {
  formatAmount,
  formatEdgeKindLabel,
  formatEventTypeLabel,
  formatMethodSelectorLabel,
  shortenAddress,
  shortenTxHash,
} from "./format";

if (typeof window !== "undefined") {
  const registry = cytoscape as unknown as { _walletMapFcoseRegistered?: boolean };
  if (!registry._walletMapFcoseRegistered) {
    cytoscape.use(fcose);
    registry._walletMapFcoseRegistered = true;
  }
}

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

interface GraphExplorerProps {
  chainId: number;
  nodes: GraphExplorerNode[];
  edges: GraphExplorerEdge[];
  totalNodes: number;
  totalEdges: number;
  truncated: boolean;
}

interface ResolvedNode extends GraphExplorerNode {
  role: "watched" | "observed" | "contract" | "entity";
  degree: number;
  shortLabel: string;
}

interface SelectionState {
  kind: "node" | "edge";
  id: string;
}

interface ViewportSnapshot {
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
}

const edgePalette: Record<GraphExplorerEdge["kind"], string> = {
  native_transfer: "#2f7d4f",
  token_transfer: "#2e44b8",
  nft_transfer: "#7a2da6",
  contract_interaction: "#b07410",
  shared_counterparty: "#a44320",
  temporal_similarity: "#525a52",
  bridge_route: "#1c66b4",
};

const DENSE_GRAPH_NODE_THRESHOLD = 28;

export function GraphExplorer({
  chainId,
  nodes,
  edges,
  totalNodes,
  totalEdges,
  truncated,
}: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRunningRef = useRef(false);
  const overviewViewportRef = useRef<ViewportSnapshot | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<GraphExplorerEdge["kind"]>>(new Set());
  const [showEdgeLabels, setShowEdgeLabels] = useState(nodes.length <= DENSE_GRAPH_NODE_THRESHOLD);
  const [layoutReady, setLayoutReady] = useState(false);

  const denseGraph = nodes.length > DENSE_GRAPH_NODE_THRESHOLD;
  const resolvedNodes = useMemo(() => resolveNodes(nodes, edges), [nodes, edges]);
  const nodeIndex = useMemo(() => {
    const map = new Map<string, ResolvedNode>();
    for (const node of resolvedNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [resolvedNodes]);

  const edgeKinds = useMemo(() => {
    const set = new Set<GraphExplorerEdge["kind"]>();
    for (const edge of edges) {
      set.add(edge.kind);
    }
    return Array.from(set);
  }, [edges]);

  const graphSignature = useMemo(
    () =>
      JSON.stringify({
        chainId,
        nodeIds: nodes.map((node) => node.id),
        edgeIds: edges.map((edge) => edge.id),
        denseGraph,
      }),
    [chainId, nodes, edges, denseGraph],
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      wheelSensitivity: 0.18,
      minZoom: 0.08,
      maxZoom: 4,
      boxSelectionEnabled: false,
      autounselectify: false,
      pixelRatio: 1,
      hideEdgesOnViewport: edges.length > 120,
      textureOnViewport: edges.length > 120,
      style: buildStylesheet(denseGraph),
    });

    cyRef.current = cy;

    cy.on("tap", (event: EventObject) => {
      if (event.target === cy) {
        restoreOverviewViewport(cy, overviewViewportRef.current);
        setSelection(null);
      }
    });

    cy.on("tap", "node", (event: EventObject) => {
      const node = event.target as NodeSingular;
      setSelection({ kind: "node", id: node.id() });
      focusElements(cy, node.closedNeighborhood(), denseGraph ? 112 : 92);
    });

    cy.on("tap", "edge", (event: EventObject) => {
      const edge = event.target as EdgeSingular;
      setSelection({ kind: "edge", id: edge.id() });
      focusElements(cy, edge.connectedNodes().union(edge), denseGraph ? 128 : 104);
    });

    cy.on("dblclick", "node", (event: EventObject) => {
      const node = event.target as NodeSingular;
      const href = node.data("href") as string | undefined;
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    });

    cy.on("dblclick", "edge", (event: EventObject) => {
      const edge = event.target as EdgeSingular;
      const href = edge.data("txHref") as string | undefined;
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
      layoutRunningRef.current = false;
    };
  }, [denseGraph, edges.length]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    setLayoutReady(false);
    layoutRunningRef.current = true;
    overviewViewportRef.current = null;

    const elements = buildElements({
      chainId,
      resolvedNodes,
      edges,
      showEdgeLabels,
      denseGraph,
    });

    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
      if (denseGraph) {
        cy.nodes().addClass("dense");
      }
    });

    const layout = cy.layout({
      name: "fcose",
      quality: resolvedNodes.length > 180 ? "draft" : "default",
      randomize: true,
      animate: false,
      nodeRepulsion: resolvedNodes.length > 80 ? 12000 : 9000,
      idealEdgeLength: resolvedNodes.length > 80 ? 150 : 120,
      edgeElasticity: 0.42,
      gravity: 0.12,
      nodeSeparation: 90,
      padding: 48,
      fit: true,
      tile: true,
      packComponents: true,
    } as cytoscape.LayoutOptions);

    layout.one("layoutstop", () => {
      fitOverviewViewport(cy, resolvedNodes.length, edges.length);
      overviewViewportRef.current = captureViewport(cy);
      layoutRunningRef.current = false;
      setLayoutReady(true);
    });
    layout.run();
  }, [graphSignature, chainId, resolvedNodes, edges, denseGraph]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || layoutRunningRef.current) {
      return;
    }

    cy.edges().forEach((edge) => {
      const kind = edge.data("kind") as GraphExplorerEdge["kind"];
      edge.toggleClass("hidden", hiddenKinds.has(kind));
    });
  }, [hiddenKinds, graphSignature]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || layoutRunningRef.current) {
      return;
    }

    cy.edges().forEach((edge) => {
      const edgeModel = edges.find((entry) => entry.id === edge.id());
      if (!edgeModel) {
        return;
      }
      edge.data("label", buildEdgeLabel(edgeModel, chainId, showEdgeLabels));
    });
  }, [showEdgeLabels, edges, chainId, graphSignature]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    cy.elements().removeClass("hl-focus hl-dim");

    if (!selection) {
      return;
    }

    if (selection.kind === "node") {
      const node = cy.getElementById(selection.id);
      if (!node || node.length === 0) {
        return;
      }
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass("hl-dim");
      neighborhood.addClass("hl-focus");
      return;
    }

    const edge = cy.getElementById(selection.id);
    if (!edge || edge.length === 0) {
      return;
    }
    const incident = edge.connectedNodes().union(edge);
    cy.elements().difference(incident).addClass("hl-dim");
    incident.addClass("hl-focus");
  }, [selection, graphSignature]);

  const handleToggleKind = useCallback((kind: GraphExplorerEdge["kind"]) => {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleRelayout = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    layoutRunningRef.current = true;
    setLayoutReady(false);
    runLayout(cy, resolvedNodes.length, edges.length, {
      fitAfter: true,
      onComplete: () => {
        overviewViewportRef.current = captureViewport(cy);
        layoutRunningRef.current = false;
        setLayoutReady(true);
      },
    });
  }, [resolvedNodes.length, edges.length]);

  const handleResetView = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    restoreOverviewViewport(cy, overviewViewportRef.current);
    setSelection(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.animate({ zoom: Math.min(cy.zoom() * 1.25, cy.maxZoom()) }, { duration: 180 });
  }, []);

  const handleZoomOut = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.animate({ zoom: Math.max(cy.zoom() * 0.8, cy.minZoom()) }, { duration: 180 });
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="graphExplorerEmpty">
        <strong>暂无可视化节点</strong>
        <p>当前结果没有产生关系图。</p>
      </div>
    );
  }

  const visibleEdgeCount = edges.filter((edge) => !hiddenKinds.has(edge.kind)).length;

  return (
    <div className="graphExplorer">
      <div className="graphToolbar">
        <div className="graphLegend" aria-label="Edge kind filter">
          {edgeKinds.map((kind) => {
            const hidden = hiddenKinds.has(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => handleToggleKind(kind)}
                className={`graphLegendItem ${hidden ? "graphLegendItemHidden" : ""}`}
                style={{ "--legend-color": edgePalette[kind] } as React.CSSProperties}
                aria-pressed={!hidden}
                title={hidden ? "点击重新显示" : "点击隐藏此类边"}
              >
                <span className="graphLegendSwatch" aria-hidden="true" />
                {formatEdgeKindLabel(kind)}
              </button>
            );
          })}
        </div>
        <div className="graphToolbarActions">
          <button
            type="button"
            className={`graphChipButton ${showEdgeLabels ? "graphChipButtonOn" : ""}`}
            onClick={() => setShowEdgeLabels((value) => !value)}
            aria-pressed={showEdgeLabels}
            title="切换边标签"
          >
            {showEdgeLabels ? "边标签 ON" : "边标签 OFF"}
          </button>
          <button type="button" className="graphChipButton" onClick={handleRelayout} title="重新跑布局">
            重新布局
          </button>
          <button type="button" className="graphChipButton" onClick={handleResetView} title="重置视图">
            适应画布
          </button>
          <span className="graphSummary">
            {nodes.length} 节点 · {visibleEdgeCount}/{totalEdges} 条已命中的关联边
            {truncated ? " · 已截断" : ""}
          </span>
        </div>
      </div>
      <div className="graphCanvasWrap">
        <div
          ref={containerRef}
          className={`graphCanvas ${layoutReady ? "graphCanvasReady" : "graphCanvasLoading"}`}
          role="region"
          aria-label="Relationship graph canvas"
        />
        <div className="graphZoomControls" aria-label="Graph zoom controls">
          <button type="button" className="graphZoomButton" onClick={handleZoomIn} title="放大">
            <Plus size={16} strokeWidth={2.2} />
          </button>
          <button type="button" className="graphZoomButton" onClick={handleZoomOut} title="缩小">
            <Minus size={16} strokeWidth={2.2} />
          </button>
          <button type="button" className="graphZoomButton" onClick={handleResetView} title="适应画布">
            <ScanSearch size={16} strokeWidth={2} />
          </button>
        </div>
        {!layoutReady ? (
          <div className="graphLayoutOverlay" aria-live="polite">
            <span className="buttonSpinner" aria-hidden="true" />
            正在计算力导向布局…
          </div>
        ) : null}
        <SelectionDetail
          selection={selection}
          chainId={chainId}
          edges={edges}
          nodeIndex={nodeIndex}
          onClose={() => {
            const cy = cyRef.current;
            if (cy) {
              restoreOverviewViewport(cy, overviewViewportRef.current);
            }
            setSelection(null);
          }}
        />
      </div>
      <p className="graphFootnote">
        {denseGraph
          ? "大图模式：默认先给你全局总览，单击节点或边会局部聚焦，点空白处可回到全图。"
          : "默认只展示命中分析器的关联子图 · 单击聚焦并查看解释 · 双击跳转 explorer。"}
        {totalNodes > nodes.length ? ` 当前展示前 ${nodes.length} / ${totalNodes} 节点。` : ""}
      </p>
    </div>
  );
}

interface SelectionDetailProps {
  selection: SelectionState | null;
  chainId: number;
  edges: GraphExplorerEdge[];
  nodeIndex: Map<string, ResolvedNode>;
  onClose: () => void;
}

function SelectionDetail({ selection, chainId, edges, nodeIndex, onClose }: SelectionDetailProps) {
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  useEffect(() => {
    setShowAllTransactions(false);
  }, [selection?.id, selection?.kind]);

  if (!selection) {
    return null;
  }

  if (selection.kind === "node") {
    const node = nodeIndex.get(selection.id);
    if (!node) {
      return null;
    }
    return (
      <div className="graphDetailCard" role="status">
        <div className="graphDetailHeader">
          <span className={`graphDetailRole graphDetailRole-${node.role}`}>{formatNodeRoleLabel(node.role)}</span>
          <button type="button" className="graphDetailClose" onClick={onClose} aria-label="关闭">
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="graphDetailBody">
          <p className="graphDetailHint">
            {describeNodeRole(node.role)}
          </p>
          <code className="graphDetailAddress" title={node.address ?? node.id}>
            {node.address ? shortenAddress(node.address) : node.id}
          </code>
          <dl className="graphDetailMetrics">
            <div>
              <dt>邻边</dt>
              <dd>{node.degree}</dd>
            </div>
            {node.label ? (
              <div>
                <dt>标签</dt>
                <dd>{node.label}</dd>
              </div>
            ) : null}
          </dl>
          {node.address ? (
            <div className="graphDetailActions">
              <a
                className="graphDetailLink"
                href={buildExplorerAddressUrl(node.chainId ?? chainId, node.address)}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ArrowUpRight size={14} strokeWidth={2.1} /> 在 explorer 中查看
              </a>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const edge = edges.find((entry) => entry.id === selection.id);
  if (!edge) {
    return null;
  }
  const edgeChainId = edge.metadata?.chainId ?? chainId;
  const txHash = edge.metadata?.txHash;
  const txHref = txHash ? buildExplorerTxUrl(edgeChainId, txHash) : undefined;
  const eventChain = getSupportedAnalysisChain(edgeChainId);
  const isNativeAsset = edge.metadata?.asset?.kind === "native";
  const amountDecimals = isNativeAsset
    ? eventChain?.nativeDecimals ?? 18
    : edge.metadata?.asset?.decimals;
  const canRenderAmount =
    edge.metadata?.amount !== undefined &&
    edge.metadata.amount !== "" &&
    (isNativeAsset || edge.metadata?.asset?.decimals !== undefined);
  const amountFormatted = canRenderAmount
    ? formatAmount(edge.metadata?.amount, amountDecimals)
    : undefined;
  const amountSymbol =
    edge.metadata?.asset?.symbol ?? (isNativeAsset ? eventChain?.nativeSymbol : undefined);
  const sourceNode = nodeIndex.get(edge.source);
  const targetNode = nodeIndex.get(edge.target);
  const transactions = edge.metadata?.transactions ?? [];
  const visibleTransactions = showAllTransactions ? transactions : transactions.slice(0, 4);

  return (
    <div className="graphDetailCard" role="status">
      <div className="graphDetailHeader">
        <span
          className="graphDetailRole"
          style={{ background: edgePalette[edge.kind] ?? "#525a52", color: "#fff" }}
        >
          {formatEdgeKindLabel(edge.kind)}
        </span>
        <button type="button" className="graphDetailClose" onClick={onClose} aria-label="关闭">
          <X size={16} strokeWidth={2.4} />
        </button>
      </div>
      <div className="graphDetailBody">
        <div className="graphDetailEndpoints">
          <span title={sourceNode?.address ?? edge.source}>
            {sourceNode?.role.toUpperCase() ?? "NODE"} ·
            <code>{shortenAddress(sourceNode?.address ?? edge.source)}</code>
          </span>
          <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
          <span title={targetNode?.address ?? edge.target}>
            {targetNode?.role.toUpperCase() ?? "NODE"} ·
            <code>{shortenAddress(targetNode?.address ?? edge.target)}</code>
          </span>
        </div>
        {amountFormatted ? (
          <div className="graphDetailAmount">
            <strong>{amountFormatted}</strong>
            <span>{amountSymbol ?? ""}</span>
          </div>
        ) : null}
        {(edge.metadata?.txCount ?? 1) > 1 ? (
          <div className="graphDetailTxCount">{edge.metadata?.txCount} 笔同类交易已聚合展示</div>
        ) : null}
        {edge.metadata?.methodId ? (
          <div className="graphDetailMethodBlock">
            <code className="graphDetailMethod" title="Method selector">
              {formatMethodSelectorLabel(edge.metadata.methodId) ?? edge.metadata.methodId}
            </code>
            <span className="graphDetailMethodMeta">{edge.metadata.methodId}</span>
          </div>
        ) : null}
        {transactions.length > 0 ? (
          <div className="graphTxListCard">
            <div className="graphTxListHeader">
              <strong>关联交易</strong>
              <span>{transactions.length} 笔</span>
            </div>
            <div className="graphTxList">
              {visibleTransactions.map((transaction) => (
                <a
                  key={transaction.txHash}
                  className="graphTxListItem"
                  href={buildExplorerTxUrl(edgeChainId, transaction.txHash)}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={transaction.txHash}
                >
                  <span className="graphTxListType">{formatEventTypeLabel(transaction.type)}</span>
                  <code>{shortenTxHash(transaction.txHash)}</code>
                </a>
              ))}
            </div>
            {transactions.length > 4 ? (
              <button
                type="button"
                className="graphTxListToggle"
                onClick={() => setShowAllTransactions((value) => !value)}
              >
                <ChevronDown
                  size={14}
                  strokeWidth={2.2}
                  className={`graphTxListToggleIcon ${showAllTransactions ? "graphTxListToggleIconOpen" : ""}`}
                />
                {showAllTransactions ? "收起交易列表" : `展开剩余 ${transactions.length - 4} 笔`}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="graphDetailActions">
          {txHash ? (
            <a className="graphDetailLink" href={txHref} target="_blank" rel="noreferrer noopener">
              <ArrowUpRight size={14} strokeWidth={2.1} /> tx {shortenTxHash(txHash)}
            </a>
          ) : null}
          {edge.metadata?.asset?.contract && !isNativeAsset ? (
            <a
              className="graphDetailLink"
              href={buildExplorerTokenUrl(edgeChainId, edge.metadata.asset.contract)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ArrowUpRight size={14} strokeWidth={2.1} /> token {edge.metadata.asset.symbol ?? ""}
            </a>
          ) : null}
        </div>
        <p className="graphDetailHint">
          {describeEdgeKind(edge.kind)} · 双击节点或边可直接跳转 explorer
        </p>
      </div>
    </div>
  );
}

interface BuildElementsInput {
  chainId: number;
  resolvedNodes: ResolvedNode[];
  edges: GraphExplorerEdge[];
  showEdgeLabels: boolean;
  denseGraph: boolean;
}

function buildElements(input: BuildElementsInput): ElementDefinition[] {
  const { chainId, resolvedNodes, edges, showEdgeLabels, denseGraph } = input;
  const elements: ElementDefinition[] = [];

  for (const node of resolvedNodes) {
    const explorerHref = node.address
      ? buildExplorerAddressUrl(node.chainId ?? chainId, node.address)
      : undefined;

    elements.push({
      group: "nodes",
      data: {
        id: node.id,
        role: node.role,
        kind: node.kind,
        label: node.shortLabel,
        size: nodeSizeForDegree(node.degree, node.role),
        href: explorerHref,
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
        label: buildEdgeLabel(edge, chainId, showEdgeLabels),
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

function buildEdgeLabel(
  edge: GraphExplorerEdge,
  chainId: number,
  showEdgeLabels: boolean,
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
  const amountFormatted = canRenderAmount
    ? formatAmount(edge.metadata?.amount, amountDecimals)
    : undefined;
  const amountSymbol =
    edge.metadata?.asset?.symbol ?? (isNativeAsset ? eventChain?.nativeSymbol : undefined);

  const labelPieces: string[] = [];
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

function getParallelEdgeCurveDistance(
  edge: GraphExplorerEdge,
  edges: GraphExplorerEdge[],
): number {
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

function getParallelEdgeLabelOffset(
  edge: GraphExplorerEdge,
  edges: GraphExplorerEdge[],
): number {
  const curveDistance = getParallelEdgeCurveDistance(edge, edges);

  if (curveDistance === 0) {
    return 10;
  }

  return Math.max(12, Math.abs(curveDistance) * 0.45);
}

function resolveNodes(
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
    const fallbackLabel = node.address ? shortenAddress(node.address) : node.label ?? node.id;
    return {
      ...node,
      role,
      degree: degreeMap.get(node.id) ?? 0,
      shortLabel: fallbackLabel,
    };
  });
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

function describeNodeRole(role: ResolvedNode["role"]): string {
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

function formatNodeRoleLabel(role: ResolvedNode["role"]): string {
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

function describeEdgeKind(kind: GraphExplorerEdge["kind"]): string {
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

function focusElements(cy: Core, elements: cytoscape.CollectionReturnValue, padding: number): void {
  if (elements.length === 0) {
    return;
  }

  cy.animate(
    {
      fit: { eles: elements, padding },
    },
    { duration: 260, easing: "ease-out-cubic" },
  );
}

function runLayout(
  cy: Core,
  nodeCount: number,
  edgeCount: number,
  options: { fitAfter?: boolean; onComplete?: () => void } = {},
): void {
  const layout = cy.layout({
    name: "fcose",
    quality: nodeCount > 180 ? "draft" : "default",
    randomize: true,
    animate: false,
    nodeRepulsion: nodeCount > 80 ? 12000 : 9000,
    idealEdgeLength: nodeCount > 80 ? 150 : 120,
    edgeElasticity: 0.42,
    gravity: 0.12,
    nodeSeparation: 90,
    padding: 48,
    fit: true,
    tile: true,
    packComponents: true,
  } as cytoscape.LayoutOptions);
  layout.one("layoutstop", () => {
    if (options.fitAfter) {
      fitOverviewViewport(cy, nodeCount, edgeCount);
    }
    options.onComplete?.();
  });
  layout.run();
}

function computeOverviewPadding(nodeCount: number, edgeCount: number): number {
  if (nodeCount > 42 || edgeCount > 72) {
    return 168;
  }

  if (nodeCount > 26 || edgeCount > 40) {
    return 132;
  }

  if (nodeCount > 14 || edgeCount > 20) {
    return 100;
  }

  return 72;
}

function fitOverviewViewport(cy: Core, nodeCount: number, edgeCount: number): void {
  const padding = computeOverviewPadding(nodeCount, edgeCount);
  cy.fit(cy.elements(), padding);
}

function captureViewport(cy: Core): ViewportSnapshot {
  const pan = cy.pan();
  return {
    zoom: cy.zoom(),
    pan: {
      x: pan.x,
      y: pan.y,
    },
  };
}

function restoreOverviewViewport(cy: Core, snapshot: ViewportSnapshot | null): void {
  if (!snapshot) {
    return;
  }

  cy.animate(
    {
      zoom: snapshot.zoom,
      pan: snapshot.pan,
    },
    { duration: 260, easing: "ease-out-cubic" },
  );
}

function buildStylesheet(denseGraph: boolean): cytoscape.StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        "background-color": "#f6faf5",
        "border-color": "#7f9a87",
        "border-width": 1.6,
        "color": "#203027",
        "label": "data(label)",
        "font-size": 9,
        "font-weight": 700,
        "text-valign": "bottom",
        "text-margin-y": 7,
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.84,
        "text-background-padding": "2",
        "text-background-shape": "roundrectangle",
        "width": "data(size)",
        "height": "data(size)",
        "shape": "ellipse",
        "overlay-padding": 8,
        "transition-property": "background-color, border-color, opacity",
        "transition-duration": 180,
      },
    },
    {
      selector: "node.node-watched",
      style: {
        "background-color": "#244534",
        "border-color": "#173022",
        "border-width": 2.4,
        "color": "#ffffff",
        "text-background-color": "#173022",
        "text-background-opacity": 0.88,
      },
    },
    {
      selector: "node.node-observed",
      style: {
        "background-color": "#e7f1e3",
        "border-color": "#6f9b79",
        "border-width": 1.6,
      },
    },
    {
      selector: "node.node-contract",
      style: {
        "background-color": "#fff7e7",
        "border-color": "#c79b43",
        "border-width": 1.6,
        "shape": "round-rectangle",
      },
    },
    {
      selector: "node.node-entity",
      style: {
        "background-color": "#f1ecfb",
        "border-color": "#8571cb",
        "border-width": 1.6,
      },
    },
    {
      selector: "node.dense",
      style: {
        "label": "",
        "font-size": 0,
      },
    },
    {
      selector: "node.dense.hl-focus, node.dense:selected",
      style: {
        "label": "data(label)",
        "font-size": 10,
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "unbundled-bezier",
        "control-point-distances": "data(curveDistance)",
        "control-point-weights": 0.5,
        "width": "data(weight)",
        "line-color": "data(color)",
        "target-arrow-color": "data(color)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.75,
        "opacity": denseGraph ? 0.45 : 0.62,
        "label": "data(label)",
        "font-size": 8,
        "color": "data(color)",
        "text-margin-y": "data(labelOffset)",
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.8,
        "text-background-padding": "2",
        "text-background-shape": "roundrectangle",
        "transition-property": "opacity, width",
        "transition-duration": 180,
      },
    },
    {
      selector: "edge.edge-dashed",
      style: {
        "line-style": "dashed",
      },
    },
    {
      selector: ".hidden",
      style: {
        display: "none",
      },
    },
    {
      selector: ".hl-dim",
      style: {
        opacity: 0.08,
      },
    },
    {
      selector: ".hl-focus",
      style: {
        opacity: 1,
        "z-index": 30,
      },
    },
    {
      selector: "node.hl-focus",
      style: {
        "border-width": 3.2,
      },
    },
    {
      selector: "edge.hl-focus",
      style: {
        width: "mapData(weight, 1, 6, 2.5, 7)",
        opacity: 0.95,
      },
    },
  ] as cytoscape.StylesheetJson;
}
