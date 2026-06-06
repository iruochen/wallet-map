import { describe, expect, it } from "vitest";
import { collectGraphChainIds, filterGraphByChain } from "./graph-utils";
import type { GraphExplorerEdge, GraphExplorerNode } from "./graph-types";

const nodes: GraphExplorerNode[] = [
  { id: "w1", kind: "wallet", address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", chainId: 1, tags: ["watched"] },
  { id: "w2", kind: "wallet", address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", chainId: 1, tags: ["watched"] },
  { id: "c1", kind: "contract", address: "0xcccccccccccccccccccccccccccccccccccccccc", chainId: 42161 },
];

const edges: GraphExplorerEdge[] = [
  {
    id: "e1",
    kind: "native_transfer",
    source: "w1",
    target: "w2",
    evidenceEventIds: ["evt-1"],
    metadata: { chainId: 1 },
  },
  {
    id: "e2",
    kind: "contract_interaction",
    source: "w1",
    target: "c1",
    evidenceEventIds: ["evt-2"],
    metadata: { chainId: 42161 },
  },
];

describe("collectGraphChainIds", () => {
  it("returns sorted unique chain ids from nodes and edges", () => {
    expect(collectGraphChainIds(nodes, edges, 0)).toEqual([42161, 1]);
  });
});

describe("filterGraphByChain", () => {
  it("returns the original graph when filter is all", () => {
    expect(filterGraphByChain({ nodes, edges, fallbackChainId: 0, chainFilter: "all" })).toEqual({
      nodes,
      edges,
    });
  });

  it("keeps only nodes and edges for the selected chain", () => {
    const filtered = filterGraphByChain({ nodes, edges, fallbackChainId: 0, chainFilter: 42161 });

    expect(filtered.edges.map((edge) => edge.id)).toEqual(["e2"]);
    expect(filtered.nodes.map((node) => node.id)).toEqual(["w1", "c1"]);
  });
});
