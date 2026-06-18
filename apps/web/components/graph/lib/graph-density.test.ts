import { describe, expect, it } from "vitest";
import { buildDenseGraphSubset } from "./graph-density";
import type { GraphExplorerEdge, ResolvedNode } from "./graph-types";

describe("buildDenseGraphSubset", () => {
  it("keeps the shared backbone and trims one-degree leaves", () => {
    const nodes: ResolvedNode[] = [
      {
        id: "w1",
        kind: "wallet",
        role: "watched",
        degree: 4,
        shortLabel: "w1",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        tags: ["watched"],
      },
      {
        id: "w2",
        kind: "wallet",
        role: "watched",
        degree: 4,
        shortLabel: "w2",
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        tags: ["watched"],
      },
      { id: "shared", kind: "wallet", role: "observed", degree: 2, shortLabel: "shared", tags: [] },
      { id: "leaf-a", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-a", tags: [] },
      { id: "leaf-b", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-b", tags: [] },
      { id: "leaf-c", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-c", tags: [] },
      { id: "leaf-d", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-d", tags: [] },
      { id: "leaf-e", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-e", tags: [] },
      { id: "leaf-f", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-f", tags: [] },
      { id: "leaf-g", kind: "wallet", role: "observed", degree: 1, shortLabel: "leaf-g", tags: [] },
    ];

    const edges: GraphExplorerEdge[] = [
      { id: "e1", kind: "native_transfer", source: "w1", target: "shared", evidenceEventIds: ["1", "2"] },
      { id: "e2", kind: "native_transfer", source: "w2", target: "shared", evidenceEventIds: ["3"] },
      { id: "e3", kind: "native_transfer", source: "w1", target: "leaf-a", evidenceEventIds: ["4"] },
      { id: "e4", kind: "native_transfer", source: "w1", target: "leaf-b", evidenceEventIds: ["5"] },
      { id: "e5", kind: "native_transfer", source: "w1", target: "leaf-c", evidenceEventIds: ["6"] },
      { id: "e6", kind: "native_transfer", source: "w1", target: "leaf-d", evidenceEventIds: ["7"] },
      { id: "e7", kind: "native_transfer", source: "w1", target: "leaf-e", evidenceEventIds: ["8"] },
      { id: "e8", kind: "native_transfer", source: "w1", target: "leaf-f", evidenceEventIds: ["9"] },
      { id: "e9", kind: "native_transfer", source: "w1", target: "leaf-g", evidenceEventIds: ["10"] },
    ];

    const subset = buildDenseGraphSubset(nodes, edges);

    expect(subset.edges.map((edge) => edge.id)).toEqual(["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]);
    expect(subset.nodes.map((node) => node.id)).toEqual([
      "w1",
      "w2",
      "shared",
      "leaf-a",
      "leaf-b",
      "leaf-c",
      "leaf-d",
      "leaf-e",
      "leaf-f",
    ]);
    expect(subset.hiddenNodeCount).toBe(1);
    expect(subset.hiddenEdgeCount).toBe(1);
  });

  it("returns the original graph when trimming would remove nothing", () => {
    const nodes: ResolvedNode[] = [
      {
        id: "w1",
        kind: "wallet",
        role: "watched",
        degree: 1,
        shortLabel: "w1",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        tags: ["watched"],
      },
      { id: "c1", kind: "contract", role: "contract", degree: 1, shortLabel: "c1", tags: [] },
    ];
    const edges: GraphExplorerEdge[] = [
      { id: "e1", kind: "contract_interaction", source: "w1", target: "c1", evidenceEventIds: ["1"] },
    ];

    expect(buildDenseGraphSubset(nodes, edges)).toEqual({
      nodes,
      edges,
      hiddenNodeCount: 0,
      hiddenEdgeCount: 0,
    });
  });
});
