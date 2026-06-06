import { describe, expect, it } from "vitest";
import {
  collectGraphChainIds,
  collectWatchedWalletOptions,
  filterGraphByChain,
  filterGraphByWallet,
} from "./graph-utils";
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

describe("collectWatchedWalletOptions", () => {
  it("deduplicates watched wallets by address across node ids", () => {
    const multiChainNodes: GraphExplorerNode[] = [
      ...nodes,
      {
        id: "w1-arb",
        kind: "wallet",
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        chainId: 42161,
        tags: ["watched"],
      },
    ];

    expect(collectWatchedWalletOptions(multiChainNodes)).toEqual([
      {
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        nodeIds: ["w1", "w1-arb"],
      },
      {
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        nodeIds: ["w2"],
      },
    ]);
  });
});

describe("filterGraphByWallet", () => {
  const watchedWalletOptions = collectWatchedWalletOptions(nodes);

  it("returns the original graph when filter is all", () => {
    expect(
      filterGraphByWallet({ nodes, edges, walletFilter: "all", watchedWalletOptions }),
    ).toEqual({ nodes, edges });
  });

  it("keeps the ego network for the selected watched wallet", () => {
    const filtered = filterGraphByWallet({
      nodes,
      edges,
      walletFilter: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      watchedWalletOptions,
    });

    expect(filtered.edges.map((edge) => edge.id)).toEqual(["e1"]);
    expect(filtered.nodes.map((node) => node.id)).toEqual(["w1", "w2"]);
  });
});
