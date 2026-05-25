"use client";

import cytoscape, {
  type Core,
  type ElementDefinition,
  type EventObject,
  type NodeSingular,
  type EdgeSingular,
} from "cytoscape";
import fcose from "cytoscape-fcose";
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
  shortenAddress,
  shortenTxHash,
} from "./format";

if (typeof window !== "undefined") {
  // cytoscape registers extensions globally; guard against double-register in HMR.
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

interface ResolvedNode extends GraphExplorerNode {
  role: "watched" | "observed" | "contract" | "entity";
  degree: number;
  shortLabel: string;
}

interface SelectionState {
  kind: "node" | "edge";
  id: string;
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
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<GraphExplorerEdge["kind"]>>(new Set());
  const [showEdgeLabels, setShowEdgeLabels] = useState(nodes.length <= 24);

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

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      wheelSensitivity: 0.25,
      minZoom: 0.15,
      maxZoom: 3,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: buildStylesheet(),
    });

    cyRef.current = cy;

    cy.on("tap", (event: EventObject) => {
      if (event.target === cy) {
        setSelection(null);
      }
    });

    cy.on("tap", "node", (event: EventObject) => {
      const node = event.target as NodeSingular;
      setSelection({ kind: "node", id: node.id() });
    });

    cy.on("tap", "edge", (event: EventObject) => {
      const edge = event.target as EdgeSingular;
      setSelection({ kind: "edge", id: edge.id() });
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
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    const elements = buildElements({
      chainId,
      resolvedNodes,
      edges,
      hiddenKinds,
      showEdgeLabels,
    });

    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });

    runLayout(cy, resolvedNodes.length);
  }, [chainId, resolvedNodes, edges, hiddenKinds, showEdgeLabels]);

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
    } else {
      const edge = cy.getElementById(selection.id);
      if (!edge || edge.length === 0) {
        return;
      }
      const incident = edge.connectedNodes().union(edge);
      cy.elements().difference(incident).addClass("hl-dim");
      incident.addClass("hl-focus");
    }
  }, [selection]);

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
    runLayout(cy, resolvedNodes.length, { fitAfter: true });
  }, [resolvedNodes.length]);

  const handleResetView = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 240 });
    setSelection(null);
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
          <button
            type="button"
            className="graphChipButton"
            onClick={handleRelayout}
            title="重新跑布局"
          >
            重新布局
          </button>
          <button
            type="button"
            className="graphChipButton"
            onClick={handleResetView}
            title="重置视图并清除选中"
          >
            重置视图
          </button>
          <span className="graphSummary">
            {nodes.length} 节点 · {visibleEdgeCount}/{totalEdges} 边
            {truncated ? " · 已截断" : ""}
          </span>
        </div>
      </div>
      <div className="graphCanvasWrap">
        <div ref={containerRef} className="graphCanvas" role="region" aria-label="Relationship graph canvas" />
        <SelectionDetail
          selection={selection}
          chainId={chainId}
          edges={edges}
          nodeIndex={nodeIndex}
          onClose={() => setSelection(null)}
        />
      </div>
      <p className="graphFootnote">
        {totalNodes > nodes.length
          ? `当前画布展示前 ${nodes.length} / ${totalNodes} 节点。`
          : `共 ${nodes.length} 节点，${totalEdges} 边。`}
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
          <span className={`graphDetailRole graphDetailRole-${node.role}`}>{node.role.toUpperCase()}</span>
          <button type="button" className="graphDetailClose" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="graphDetailBody">
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
                <span aria-hidden="true">↗</span> 在 explorer 中查看
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
          ×
        </button>
      </div>
      <div className="graphDetailBody">
        <div className="graphDetailEndpoints">
          <span title={sourceNode?.address ?? edge.source}>
            {sourceNode?.role.toUpperCase() ?? "NODE"} ·
            <code>{shortenAddress(sourceNode?.address ?? edge.source)}</code>
          </span>
          <span aria-hidden="true">→</span>
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
        {edge.metadata?.methodId ? (
          <code className="graphDetailMethod" title="Method selector">
            {edge.metadata.methodId}
          </code>
        ) : null}
        <div className="graphDetailActions">
          {txHash ? (
            <a className="graphDetailLink" href={txHref} target="_blank" rel="noreferrer noopener">
              <span aria-hidden="true">↗</span> tx {shortenTxHash(txHash)}
            </a>
          ) : null}
          {edge.metadata?.asset?.contract && !isNativeAsset ? (
            <a
              className="graphDetailLink"
              href={buildExplorerTokenUrl(edgeChainId, edge.metadata.asset.contract)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span aria-hidden="true">↗</span> token {edge.metadata.asset.symbol ?? ""}
            </a>
          ) : null}
        </div>
        <p className="graphDetailHint">
          双击节点或边可直接跳转 explorer · {formatEventTypeLabel(edge.kind)}
        </p>
      </div>
    </div>
  );
}

interface BuildElementsInput {
  chainId: number;
  resolvedNodes: ResolvedNode[];
  edges: GraphExplorerEdge[];
  hiddenKinds: Set<GraphExplorerEdge["kind"]>;
  showEdgeLabels: boolean;
}

function buildElements(input: BuildElementsInput): ElementDefinition[] {
  const { chainId, resolvedNodes, edges, hiddenKinds, showEdgeLabels } = input;
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
      classes: `node-${node.role}`,
    });
  }

  for (const edge of edges) {
    if (hiddenKinds.has(edge.kind)) {
      continue;
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
      labelPieces.push(edge.metadata.methodId);
    }

    elements.push({
      group: "edges",
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
        color: edgePalette[edge.kind] ?? "#525a52",
        label: showEdgeLabels ? labelPieces.join(" · ") : "",
        weight: Math.max(1, Math.log2((edge.evidenceEventIds?.length ?? 1) + 1) + 1),
        txHref: edge.metadata?.txHash ? buildExplorerTxUrl(edgeChainId, edge.metadata.txHash) : undefined,
        dashed: edge.kind === "shared_counterparty",
      },
      classes: edge.kind === "shared_counterparty" ? "edge-dashed" : undefined,
    });
  }

  return elements;
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
  const base = role === "watched" ? 56 : role === "observed" ? 38 : role === "contract" ? 36 : 32;
  const bonus = Math.min(Math.log2(degree + 1) * 6, 28);
  return base + bonus;
}

function runLayout(cy: Core, nodeCount: number, options: { fitAfter?: boolean } = {}): void {
  const layout = cy.layout({
    name: "fcose",
    quality: nodeCount > 200 ? "draft" : "default",
    randomize: true,
    animate: false,
    nodeRepulsion: 8000,
    idealEdgeLength: nodeCount > 80 ? 140 : 110,
    edgeElasticity: 0.45,
    gravity: 0.18,
    nodeSeparation: 80,
    padding: 40,
    fit: true,
    tile: true,
    packComponents: true,
  } as cytoscape.LayoutOptions);
  layout.run();
  if (options.fitAfter) {
    cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 240 });
  }
}

function buildStylesheet(): cytoscape.StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        "background-color": "#f1f5ee",
        "border-color": "#1f3d2c",
        "border-width": 2,
        "color": "#162018",
        "label": "data(label)",
        "font-size": 10,
        "font-weight": 600,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.85,
        "text-background-padding": "2",
        "text-background-shape": "roundrectangle",
        "width": "data(size)",
        "height": "data(size)",
        "shape": "ellipse",
        "overlay-padding": 6,
        "transition-property": "background-color, border-color, opacity",
        "transition-duration": 160,
      },
    },
    {
      selector: "node.node-watched",
      style: {
        "background-color": "#1f3d2c",
        "border-color": "#0f1f15",
        "color": "#ffffff",
        "text-background-color": "#0f1f15",
        "text-background-opacity": 0.9,
      },
    },
    {
      selector: "node.node-observed",
      style: {
        "background-color": "#d6e9d2",
        "border-color": "#3e7050",
      },
    },
    {
      selector: "node.node-contract",
      style: {
        "background-color": "#fff1d2",
        "border-color": "#b07410",
        "shape": "round-diamond",
      },
    },
    {
      selector: "node.node-entity",
      style: {
        "background-color": "#e6e2f5",
        "border-color": "#5a4ab0",
        "shape": "round-hexagon",
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "width": "data(weight)",
        "line-color": "data(color)",
        "target-arrow-color": "data(color)",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.9,
        "opacity": 0.7,
        "label": "data(label)",
        "font-size": 9,
        "color": "data(color)",
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.9,
        "text-background-padding": "2",
        "text-background-shape": "roundrectangle",
        "transition-property": "opacity, width",
        "transition-duration": 160,
      },
    },
    {
      selector: "edge.edge-dashed",
      style: {
        "line-style": "dashed",
      },
    },
    {
      selector: ".hl-dim",
      style: {
        "opacity": 0.12,
      },
    },
    {
      selector: ".hl-focus",
      style: {
        "opacity": 1,
        "z-index": 30,
      },
    },
    {
      selector: "node.hl-focus",
      style: {
        "border-width": 4,
      },
    },
    {
      selector: "edge.hl-focus",
      style: {
        "width": "mapData(weight, 1, 6, 3, 8)",
      },
    },
  ] as cytoscape.StylesheetJson;
}
