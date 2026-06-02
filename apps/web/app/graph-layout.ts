import type { Core } from "cytoscape";
import type cytoscape from "cytoscape";
import type { GraphExplorerEdge, ResolvedNode } from "./graph-types";

export function runLayout(
  cy: Core,
  nodes: ResolvedNode[],
  edges: GraphExplorerEdge[],
  denseGraph: boolean,
  watchedNodeIds: string[],
  options: { fitAfter?: boolean; onComplete?: () => void } = {},
): void {
  const layout = cy.layout(
    buildLayoutOptions(cy, nodes, edges, denseGraph, watchedNodeIds, {
      fit: options.fitAfter ?? false,
    }),
  );
  layout.one("layoutstop", () => {
    if (options.fitAfter) {
      fitOverviewViewport(cy, nodes.length, edges.length);
    }
    options.onComplete?.();
  });
  layout.run();
}

export function buildLayoutOptions(
  cy: Core,
  nodes: ResolvedNode[],
  edges: GraphExplorerEdge[],
  denseGraph: boolean,
  watchedNodeIds: string[],
  options: { fit?: boolean } = {},
): cytoscape.LayoutOptions {
  const shouldFit = options.fit ?? true;

  if (denseGraph) {
    const containerWidth = cy.container()?.clientWidth ?? 0;
    const containerHeight = cy.container()?.clientHeight ?? 0;
    const positions = buildDensePresetPositions(nodes, edges, watchedNodeIds, {
      width: containerWidth,
      height: containerHeight,
    });
    return {
      name: "preset",
      animate: false,
      fit: shouldFit,
      padding: 48,
      positions: Object.fromEntries(positions),
    } as cytoscape.LayoutOptions;
  }

  return {
    name: "fcose",
    quality: nodes.length > 180 ? "draft" : "default",
    randomize: true,
    animate: false,
    nodeRepulsion: nodes.length > 80 ? 14000 : 10000,
    idealEdgeLength: nodes.length > 80 ? 170 : 132,
    edgeElasticity: 0.42,
    gravity: 0.1,
    nodeSeparation: 96,
    padding: 56,
    fit: shouldFit,
    tile: true,
    packComponents: true,
  } as cytoscape.LayoutOptions;
}

function buildDensePresetPositions(
  nodes: ResolvedNode[],
  edges: GraphExplorerEdge[],
  watchedNodeIds: string[],
  viewport: { width: number; height: number },
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const watchedNodes = nodes
    .filter((node) => watchedNodeIds.includes(node.id))
    .sort((left, right) => watchedNodeIds.indexOf(left.id) - watchedNodeIds.indexOf(right.id));
  const nonWatchedNodes = nodes.filter((node) => !watchedNodeIds.includes(node.id));
  const width = Math.max(viewport.width, 1200);
  const height = Math.max(viewport.height, 760);
  const aspectRatio = width / Math.max(height, 1);
  const watchedSpacing = Math.max(
    watchedNodes.length > 2 ? 260 : 340,
    Math.min(width * 0.22, watchedNodes.length > 2 ? 340 : 460),
  );
  const watchedXs = watchedNodes.map(
    (_, index) => (index - (watchedNodes.length - 1) / 2) * watchedSpacing,
  );

  watchedNodes.forEach((node, index) => {
    positions.set(node.id, { x: watchedXs[index] ?? 0, y: 0 });
  });

  const connectedWatchedMap = buildConnectedWatchedMap(edges, watchedNodeIds);
  const sideAnchors = buildDenseAnchors(watchedNodeIds, watchedXs, aspectRatio);

  const contractBuckets = new Map<string, ResolvedNode[]>();
  const observedBuckets = new Map<string, ResolvedNode[]>();
  const entityBuckets = new Map<string, ResolvedNode[]>();

  for (const node of nonWatchedNodes.sort((left, right) => right.degree - left.degree)) {
    const connected = connectedWatchedMap.get(node.id) ?? [];
    const bucketKey = resolveDenseBucketKey(connected, watchedNodeIds);

    if (node.role === "contract") {
      pushDenseBucket(contractBuckets, bucketKey, node);
      continue;
    }

    if (node.role === "observed") {
      pushDenseBucket(observedBuckets, bucketKey, node);
      continue;
    }

    pushDenseBucket(entityBuckets, bucketKey, node);
  }

  for (const [bucketKey, bucketNodes] of contractBuckets) {
    const anchor = sideAnchors.contract.get(bucketKey) ?? sideAnchors.contract.get("shared");
    if (anchor) {
      placeBucketArc(bucketNodes, positions, anchor, "top");
    }
  }

  for (const [bucketKey, bucketNodes] of observedBuckets) {
    const anchor = sideAnchors.observed.get(bucketKey) ?? sideAnchors.observed.get("shared");
    if (anchor) {
      placeBucketArc(bucketNodes, positions, anchor, "bottom");
    }
  }

  for (const [bucketKey, bucketNodes] of entityBuckets) {
    const anchor = sideAnchors.entity.get(bucketKey) ?? sideAnchors.entity.get("shared");
    if (anchor) {
      placeBucketArc(bucketNodes, positions, anchor, "outer");
    }
  }

  return positions;
}

function buildConnectedWatchedMap(
  edges: GraphExplorerEdge[],
  watchedNodeIds: string[],
): Map<string, string[]> {
  const watchedSet = new Set(watchedNodeIds);
  const connectedMap = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (watchedSet.has(edge.source) && !watchedSet.has(edge.target)) {
      const current = connectedMap.get(edge.target) ?? new Set<string>();
      current.add(edge.source);
      connectedMap.set(edge.target, current);
    }

    if (watchedSet.has(edge.target) && !watchedSet.has(edge.source)) {
      const current = connectedMap.get(edge.source) ?? new Set<string>();
      current.add(edge.target);
      connectedMap.set(edge.source, current);
    }
  }

  return new Map(
    Array.from(connectedMap.entries()).map(([nodeId, watchedIds]) => [
      nodeId,
      Array.from(watchedIds).sort((left, right) => watchedNodeIds.indexOf(left) - watchedNodeIds.indexOf(right)),
    ]),
  );
}

function resolveDenseBucketKey(connectedWatchedIds: string[], watchedNodeIds: string[]): string {
  if (connectedWatchedIds.length === 0) {
    return "shared";
  }

  if (connectedWatchedIds.length === 1) {
    return connectedWatchedIds[0];
  }

  if (connectedWatchedIds.length === watchedNodeIds.length) {
    return "shared";
  }

  return connectedWatchedIds.join("|");
}

function pushDenseBucket(
  buckets: Map<string, ResolvedNode[]>,
  bucketKey: string,
  node: ResolvedNode,
): void {
  const current = buckets.get(bucketKey) ?? [];
  current.push(node);
  buckets.set(bucketKey, current);
}

function buildDenseAnchors(
  watchedNodeIds: string[],
  watchedXs: number[],
  aspectRatio: number,
): {
  contract: Map<string, BucketAnchor>;
  observed: Map<string, BucketAnchor>;
  entity: Map<string, BucketAnchor>;
} {
  const contract = new Map<string, BucketAnchor>();
  const observed = new Map<string, BucketAnchor>();
  const entity = new Map<string, BucketAnchor>();
  const wideScale = Math.min(Math.max(aspectRatio, 1.1), 2);
  const contractRadiusX = 210 * wideScale;
  const observedRadiusX = 230 * wideScale;
  const sharedContractRadiusX = 320 * wideScale;
  const sharedObservedRadiusX = 350 * wideScale;

  watchedNodeIds.forEach((watchedId, index) => {
    const baseX = watchedXs[index] ?? 0;
    const direction = watchedNodeIds.length <= 1 ? 0 : Math.sign(baseX || index - (watchedNodeIds.length - 1) / 2);
    contract.set(watchedId, {
      centerX: baseX + direction * 72,
      centerY: -178,
      radiusX: contractRadiusX,
      radiusY: 74,
    });
    observed.set(watchedId, {
      centerX: baseX + direction * 90,
      centerY: 188,
      radiusX: observedRadiusX,
      radiusY: 82,
    });
    entity.set(watchedId, {
      centerX: baseX + direction * 120,
      centerY: 0,
      radiusX: 140,
      radiusY: 150,
    });
  });

  contract.set("shared", {
    centerX: 0,
    centerY: -256,
    radiusX: sharedContractRadiusX,
    radiusY: 92,
  });
  observed.set("shared", {
    centerX: 0,
    centerY: 270,
    radiusX: sharedObservedRadiusX,
    radiusY: 96,
  });
  entity.set("shared", { centerX: 0, centerY: 0, radiusX: 460 * wideScale, radiusY: 156 });

  return { contract, observed, entity };
}

interface BucketAnchor {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
}

function placeBucketArc(
  nodes: ResolvedNode[],
  positions: Map<string, { x: number; y: number }>,
  anchor: BucketAnchor,
  mode: "top" | "bottom" | "outer",
): void {
  if (nodes.length === 0) {
    return;
  }

  let startAngle = -Math.PI * 0.92;
  let endAngle = -Math.PI * 0.08;

  if (mode === "bottom") {
    startAngle = Math.PI * 0.08;
    endAngle = Math.PI * 0.92;
  }

  if (mode === "outer") {
    startAngle = -Math.PI * 0.2;
    endAngle = Math.PI * 1.2;
  }

  if (nodes.length === 1) {
    const angle = (startAngle + endAngle) / 2;
    positions.set(nodes[0].id, {
      x: anchor.centerX + Math.cos(angle) * anchor.radiusX,
      y: anchor.centerY + Math.sin(angle) * anchor.radiusY,
    });
    return;
  }

  nodes.forEach((node, index) => {
    const ratio = index / (nodes.length - 1);
    const angle = startAngle + (endAngle - startAngle) * ratio;
    positions.set(node.id, {
      x: anchor.centerX + Math.cos(angle) * anchor.radiusX,
      y: anchor.centerY + Math.sin(angle) * anchor.radiusY,
    });
  });
}

function computeOverviewPadding(nodeCount: number, edgeCount: number): number {
  if (nodeCount > 42 || edgeCount > 72) {
    return 72;
  }

  if (nodeCount > 26 || edgeCount > 40) {
    return 56;
  }

  if (nodeCount > 14 || edgeCount > 20) {
    return 42;
  }

  return 32;
}

export function fitOverviewViewport(cy: Core, nodeCount: number, edgeCount: number): void {
  const padding = computeOverviewPadding(nodeCount, edgeCount);
  cy.fit(cy.elements(), padding);
}
