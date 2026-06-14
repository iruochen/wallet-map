"use client";

import cytoscape, {
  type Core,
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
} from "../../app/chains";
import {
  formatAmount,
  formatEdgeKindLabel,
  formatEventTypeLabel,
  formatMethodSelectorLabel,
  shortenAddress,
  shortenTxHash,
} from "../../app/format";
import type { GraphExplorerEdge, GraphExplorerNode, ResolvedNode } from "./lib/graph-types";
import { buildLayoutOptions, fitOverviewViewport, runLayout } from "./lib/graph-layout";
import { formatEdgeKindLegendLabel } from "../analysis/lib/formatters";
import { useI18n } from "../i18n/i18n-provider";
import {
  buildElements,
  buildEdgeLabel,
  collectGraphChainIds,
  collectWatchedWalletOptions,
  describeEdgeKind,
  describeNodeRole,
  edgePalette,
  filterGraphByChain,
  filterGraphByWallet,
  formatChainShortName,
  formatNodeRoleLabel,
  hasMultipleChains,
  resolveNodes,
} from "./lib/graph-utils";

if (typeof window !== "undefined") {
  const registry = cytoscape as unknown as { _walletMapFcoseRegistered?: boolean };
  if (!registry._walletMapFcoseRegistered) {
    cytoscape.use(fcose);
    registry._walletMapFcoseRegistered = true;
  }
}

interface GraphExplorerProps {
  chainId: number;
  nodes: GraphExplorerNode[];
  edges: GraphExplorerEdge[];
  totalNodes: number;
  totalEdges: number;
  truncated: boolean;
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

const DENSE_GRAPH_NODE_THRESHOLD = 28;
const DENSE_GRAPH_EDGE_THRESHOLD = 32;

export function GraphExplorer({
  chainId,
  nodes,
  edges,
  totalNodes,
  totalEdges,
  truncated,
}: GraphExplorerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRunningRef = useRef(false);
  const overviewViewportRef = useRef<ViewportSnapshot | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<GraphExplorerEdge["kind"]>>(new Set());
  const [chainFilter, setChainFilter] = useState<number | "all">("all");
  const [walletFilter, setWalletFilter] = useState<string | "all">("all");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [layoutReady, setLayoutReady] = useState(false);

  const watchedWalletOptions = useMemo(() => collectWatchedWalletOptions(nodes), [nodes]);
  const showWalletFilter = watchedWalletOptions.length > 1;
  const availableChains = useMemo(
    () => collectGraphChainIds(nodes, edges, chainId),
    [nodes, edges, chainId],
  );
  const showChainFilter = availableChains.length > 1;
  const filteredGraph = useMemo(() => {
    const byChain = filterGraphByChain({
      nodes,
      edges,
      fallbackChainId: chainId,
      chainFilter,
    });

    return filterGraphByWallet({
      nodes: byChain.nodes,
      edges: byChain.edges,
      walletFilter,
      watchedWalletOptions,
    });
  }, [nodes, edges, chainId, chainFilter, walletFilter, watchedWalletOptions]);
  const visibleNodes = filteredGraph.nodes;
  const visibleEdges = filteredGraph.edges;

  const denseGraph =
    visibleNodes.length > DENSE_GRAPH_NODE_THRESHOLD || visibleEdges.length > DENSE_GRAPH_EDGE_THRESHOLD;
  const resolvedNodes = useMemo(() => resolveNodes(visibleNodes, visibleEdges), [visibleNodes, visibleEdges]);
  const watchedNodeIds = useMemo(
    () => resolvedNodes.filter((node) => node.role === "watched").map((node) => node.id),
    [resolvedNodes],
  );
  const nodeIndex = useMemo(() => {
    const map = new Map<string, ResolvedNode>();
    for (const node of resolvedNodes) {
      map.set(node.id, node);
    }
    return map;
  }, [resolvedNodes]);

  const edgeKinds = useMemo(() => {
    const set = new Set<GraphExplorerEdge["kind"]>();
    for (const edge of visibleEdges) {
      set.add(edge.kind);
    }
    return Array.from(set);
  }, [visibleEdges]);

  const graphSignature = useMemo(
    () =>
      JSON.stringify({
        chainId,
        chainFilter,
        walletFilter,
        nodeIds: visibleNodes.map((node) => node.id),
        edgeIds: visibleEdges.map((edge) => edge.id),
        denseGraph,
      }),
    [chainId, chainFilter, walletFilter, visibleNodes, visibleEdges, denseGraph],
  );

  useEffect(() => {
    setChainFilter("all");
    setWalletFilter("all");
    setSelection(null);
    setHiddenKinds(new Set());
  }, [chainId, nodes, edges]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      minZoom: 0.08,
      maxZoom: 4,
      boxSelectionEnabled: false,
      autounselectify: false,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      hideEdgesOnViewport: edges.length > 120,
      textureOnViewport: edges.length > 120,
      style: buildStylesheet(denseGraph),
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
      focusElements(cy, node.closedNeighborhood(), denseGraph ? 112 : 92, { preserveZoomOut: true });
    });

    cy.on("tap", "edge", (event: EventObject) => {
      const edge = event.target as EdgeSingular;
      setSelection({ kind: "edge", id: edge.id() });
      focusElements(cy, edge.connectedNodes().union(edge), denseGraph ? 128 : 104, { preserveZoomOut: true });
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
      edges: visibleEdges,
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

    const layout = cy.layout(buildLayoutOptions(cy, resolvedNodes, visibleEdges, denseGraph, watchedNodeIds));

    layout.one("layoutstop", () => {
      fitOverviewViewport(cy, resolvedNodes.length, visibleEdges.length);
      overviewViewportRef.current = captureViewport(cy);
      layoutRunningRef.current = false;
      setLayoutReady(true);
    });
    layout.run();
  }, [graphSignature, chainId, resolvedNodes, visibleEdges, denseGraph, watchedNodeIds, showEdgeLabels]);

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
      const edgeModel = visibleEdges.find((entry) => entry.id === edge.id());
      if (!edgeModel) {
        return;
      }
      edge.data(
        "label",
        buildEdgeLabel(
          edgeModel,
          chainId,
          showEdgeLabels,
          hasMultipleChains(resolvedNodes, visibleEdges, chainId),
        ),
      );
    });
  }, [showEdgeLabels, visibleEdges, chainId, resolvedNodes, graphSignature]);

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
    const currentViewport = captureViewport(cy);
    layoutRunningRef.current = true;
    runLayout(cy, resolvedNodes, visibleEdges, denseGraph, watchedNodeIds, {
      fitAfter: false,
      onComplete: () => {
        setViewport(cy, currentViewport);
        layoutRunningRef.current = false;
        setLayoutReady(true);
      },
    });
  }, [resolvedNodes, visibleEdges.length, denseGraph, watchedNodeIds]);

  const handleResetView = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }
    cy.resize();
    fitOverviewViewport(cy, resolvedNodes.length, visibleEdges.length);
    overviewViewportRef.current = captureViewport(cy);
    setSelection(null);
  }, [resolvedNodes.length, visibleEdges.length]);

  const handleChainFilterChange = useCallback((nextFilter: number | "all") => {
    setChainFilter(nextFilter);
    setSelection(null);
  }, []);

  const handleWalletFilterChange = useCallback((nextFilter: string | "all") => {
    setWalletFilter(nextFilter);
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
        <strong>{t("graph.empty.title")}</strong>
        <p>{t("graph.empty.body")}</p>
      </div>
    );
  }

  const visibleEdgeCount = visibleEdges.filter((edge) => !hiddenKinds.has(edge.kind)).length;
  const activeChainLabel = chainFilter === "all" ? "ALL" : formatChainShortName(chainFilter);
  const activeWalletLabel =
    walletFilter === "all" ? "ALL" : shortenAddress(walletFilter);
  const filteredEmptyTitle =
    walletFilter !== "all" && chainFilter !== "all"
      ? t("graph.filtered.emptyCombined", { wallet: activeWalletLabel, chain: activeChainLabel })
      : walletFilter !== "all"
        ? t("graph.filtered.emptyWallet", { wallet: activeWalletLabel })
        : chainFilter !== "all"
          ? t("graph.filtered.emptyChain", { chain: activeChainLabel })
          : t("graph.filtered.emptyDefault");
  const filteredEmptyHint =
    walletFilter !== "all" || chainFilter !== "all"
      ? t("graph.filtered.hintFiltered")
      : t("graph.filtered.hintDefault");

  return (
    <div className="graphExplorer">
      <div className="graphToolbar">
        {showWalletFilter ? (
          <div className="graphChainFilter" aria-label={t("graph.walletFilter")}>
            <span className="graphChainFilterLabel">{t("graph.walletFilter")}</span>
            <button
              type="button"
              className={`graphChipButton ${walletFilter === "all" ? "graphChipButtonOn" : ""}`}
              onClick={() => handleWalletFilterChange("all")}
              aria-pressed={walletFilter === "all"}
            >
              ALL
            </button>
            {watchedWalletOptions.map((wallet) => (
              <button
                key={wallet.address}
                type="button"
                className={`graphChipButton graphWalletFilterButton ${walletFilter.toLowerCase() === wallet.address.toLowerCase() ? "graphChipButtonOn" : ""}`}
                onClick={() => handleWalletFilterChange(wallet.address)}
                aria-pressed={walletFilter.toLowerCase() === wallet.address.toLowerCase()}
                title={wallet.address}
              >
                {shortenAddress(wallet.address)}
              </button>
            ))}
          </div>
        ) : null}
        {showChainFilter ? (
          <div className="graphChainFilter" aria-label={t("graph.chainFilter")}>
            <span className="graphChainFilterLabel">{t("graph.chainFilter")}</span>
            <button
              type="button"
              className={`graphChipButton ${chainFilter === "all" ? "graphChipButtonOn" : ""}`}
              onClick={() => handleChainFilterChange("all")}
              aria-pressed={chainFilter === "all"}
            >
              ALL
            </button>
            {availableChains.map((availableChainId) => (
              <button
                key={availableChainId}
                type="button"
                className={`graphChipButton ${chainFilter === availableChainId ? "graphChipButtonOn" : ""}`}
                onClick={() => handleChainFilterChange(availableChainId)}
                aria-pressed={chainFilter === availableChainId}
              >
                {formatChainShortName(availableChainId)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="graphToolbarMain">
        <div className="graphLegend" aria-label={t("graph.edgeKindFilter")}>
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
                title={
                  hidden
                    ? `${formatEdgeKindLabel(kind)} · ${t("graph.showAgain")}`
                    : `${formatEdgeKindLabel(kind)} · ${t("graph.hideKind")}`
                }
              >
                <span className="graphLegendSwatch" aria-hidden="true" />
                {formatEdgeKindLegendLabel(t, kind)}
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
            title={t("graph.toggleEdgeLabels")}
          >
            {showEdgeLabels ? t("graph.edgeLabelsOn") : t("graph.edgeLabelsOff")}
          </button>
          <button type="button" className="graphChipButton" onClick={handleRelayout} title={t("graph.relayoutTitle")}>
            {t("graph.relayout")}
          </button>
          <button type="button" className="graphChipButton" onClick={handleResetView} title={t("graph.resetTitle")}>
            {t("graph.reset")}
          </button>
          <span className="graphSummary">
            {t("graph.nodes", { count: visibleNodes.length })} · {t("graph.edges", {
              visible: visibleEdgeCount,
              total: visibleEdges.length,
            })}
            {showWalletFilter && walletFilter !== "all" ? ` · ${activeWalletLabel}` : ""}
            {showChainFilter && chainFilter !== "all" ? ` · ${activeChainLabel}` : ""}
            {truncated ? ` · ${t("graph.truncated")}` : ""}
          </span>
        </div>
        </div>
      </div>
      <div className="graphCanvasWrap">
        <div
          ref={containerRef}
          className={`graphCanvas ${layoutReady ? "graphCanvasReady" : "graphCanvasLoading"}`}
          role="region"
          aria-label={t("graph.canvas")}
        />
        {visibleEdges.length === 0 ? (
          <div className="graphExplorerEmpty graphExplorerEmptyFiltered">
            <strong>{filteredEmptyTitle}</strong>
            <p>{filteredEmptyHint}</p>
          </div>
        ) : (
          <>
        <div className="graphZoomControls" aria-label={t("graph.zoom")}>
          <button type="button" className="graphZoomButton" onClick={handleZoomIn} title={t("graph.zoomIn")}>
            <Plus size={16} strokeWidth={2.2} />
          </button>
          <button type="button" className="graphZoomButton" onClick={handleZoomOut} title={t("graph.zoomOut")}>
            <Minus size={16} strokeWidth={2.2} />
          </button>
          <button type="button" className="graphZoomButton" onClick={handleResetView} title={t("graph.reset")}>
            <ScanSearch size={16} strokeWidth={2} />
          </button>
        </div>
        {!layoutReady ? (
          <div className="graphLayoutOverlay" aria-live="polite">
            <span className="buttonSpinner" aria-hidden="true" />
            {t("graph.layouting")}
          </div>
        ) : null}
        <SelectionDetail
          selection={selection}
          chainId={chainId}
          edges={visibleEdges}
          nodeIndex={nodeIndex}
          onClose={() => {
            setSelection(null);
          }}
        />
          </>
        )}
      </div>
      <p className="graphFootnote">
        {denseGraph
          ? t("graph.footnote.dense")
          : t("graph.footnote.default")}
        {totalNodes > visibleNodes.length
          ? ` ${t("graph.footnote.visibleNodes", { visible: visibleNodes.length, total: totalNodes })}`
          : ""}
        {showChainFilter && chainFilter !== "all"
          ? ` ${t("graph.footnote.chainOnly", { chain: activeChainLabel })}`
          : ""}
        {showWalletFilter && walletFilter !== "all"
          ? ` ${t("graph.footnote.walletOnly", { wallet: activeWalletLabel })}`
          : ""}
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
  const { t } = useI18n();
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
    const labelTitle = node.label && node.label !== node.shortLabel ? node.label : undefined;

    return (
      <div className="graphDetailCard" role="status">
        <div className="graphDetailHeader">
          <span className={`graphDetailRole graphDetailRole-${node.role}`}>{formatNodeRoleLabel(node.role)}</span>
          <button type="button" className="graphDetailClose" onClick={onClose} aria-label={t("graph.detail.close")}>
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        <div className="graphDetailBody">
          <p className="graphDetailHint">
            {describeNodeRole(t, node.role)}
          </p>
          <code className="graphDetailAddress" title={node.address ?? node.id}>
            {node.address ? shortenAddress(node.address) : node.id}
          </code>
          <dl className="graphDetailMetrics">
            <div>
              <dt>{t("graph.detail.neighborEdges")}</dt>
              <dd>{node.degree}</dd>
            </div>
            {node.label ? (
              <div>
                <dt>{t("graph.detail.label")}</dt>
                <dd title={labelTitle}>{node.shortLabel}</dd>
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
                <ArrowUpRight size={14} strokeWidth={2.1} /> {t("graph.detail.viewExplorer")}
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
        <span className="chainBadge">{formatChainShortName(edgeChainId)}</span>
        <button type="button" className="graphDetailClose" onClick={onClose} aria-label={t("graph.detail.close")}>
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
          <div className="graphDetailTxCount">
            {t("graph.detail.aggregatedTx", { count: edge.metadata?.txCount ?? 0 })}
          </div>
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
              <strong>{t("graph.detail.relatedTx")}</strong>
              <span>{t("graph.detail.txCount", { count: transactions.length })}</span>
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
                {showAllTransactions
                  ? t("graph.detail.collapseTx")
                  : t("graph.detail.expandTx", { count: transactions.length - 4 })}
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
          {t("graph.detail.hint", { description: describeEdgeKind(t, edge.kind) })}
        </p>
      </div>
    </div>
  );
}

function focusElements(
  cy: Core,
  elements: cytoscape.CollectionReturnValue,
  padding: number,
  options: { preserveZoomOut?: boolean } = {},
): void {
  if (elements.length === 0) {
    return;
  }

  if (options.preserveZoomOut) {
    cy.animate(
      {
        center: { eles: elements },
        zoom: Math.max(cy.zoom(), Math.min(1.25, cy.maxZoom())),
      },
      { duration: 260, easing: "ease-out-cubic" },
    );
    return;
  }

  cy.animate(
    {
      fit: { eles: elements, padding },
    },
    { duration: 260, easing: "ease-out-cubic" },
  );
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

function setViewport(cy: Core, snapshot: ViewportSnapshot): void {
  cy.zoom(snapshot.zoom);
  cy.pan(snapshot.pan);
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
        "font-size": 11,
        "font-weight": 700,
        "text-valign": "bottom",
        "text-margin-y": 7,
        "text-background-color": "#ffffff",
        "text-background-opacity": 0.94,
        "text-background-padding": "3",
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
        "font-size": 10,
        "text-margin-y": 6,
        "text-background-opacity": 0.92,
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
        "opacity": denseGraph ? 0.56 : 0.62,
        "label": "data(label)",
        "font-size": denseGraph ? 9 : 10,
        "color": "data(color)",
        "text-margin-y": "data(labelOffset)",
        "text-background-color": "#ffffff",
        "text-background-opacity": denseGraph ? 0.94 : 0.9,
        "text-background-padding": denseGraph ? "3" : "2",
        "text-background-shape": "roundrectangle",
        "text-outline-color": "#ffffff",
        "text-outline-opacity": denseGraph ? 0.96 : 0.84,
        "text-outline-width": denseGraph ? 1.6 : 0.8,
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
