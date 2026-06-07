import type { Finding, RelationshipGraph } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { buildGraphViewModel } from "./graph-view";

describe("buildGraphViewModel", () => {
  it("builds a stable display contract from presentation graph data", () => {
    const graph: RelationshipGraph = {
      nodes: [
        {
          id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 1,
          tags: ["watched"],
        },
        {
          id: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          kind: "wallet",
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          chainId: 1,
          tags: ["watched"],
        },
        {
          id: "contract:1:0xcccccccccccccccccccccccccccccccccccccccc",
          kind: "contract",
          address: "0xcccccccccccccccccccccccccccccccccccccccc",
          chainId: 1,
        },
      ],
      edges: [
        {
          id: "edge:direct",
          kind: "native_transfer",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          weight: 2,
          evidenceEventIds: ["event:1", "event:2"],
          metadata: {
            chainId: 1,
            txCount: 2,
          },
        },
        {
          id: "edge:contract",
          kind: "contract_interaction",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "contract:1:0xcccccccccccccccccccccccccccccccccccccccc",
          weight: 1,
          evidenceEventIds: ["event:3"],
          metadata: {
            chainId: 1,
            methodId: "0xa9059cbb",
          },
        },
      ],
    };
    const findings = [
      {
        id: "finding:direct",
        analyzerId: "direct-transfer",
        title: "Direct transfer found",
        description: "",
        severity: "high",
        confidence: "high",
        scoreImpact: 40,
        evidence: [],
        metadata: {
          edgeId: "edge:direct",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
    ] as Finding[];

    const view = buildGraphViewModel({
      defaultChainId: 1,
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      nodesTruncated: false,
      edgesTruncated: false,
      nodes: graph.nodes,
      edges: graph.edges,
      findings,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(view.schemaVersion).toBe("1.0");
    expect(view.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(view.summary).toEqual({
      nodeCount: 3,
      edgeCount: 2,
      visibleNodeCount: 3,
      visibleEdgeCount: 2,
      truncated: false,
    });
    expect(view.availableChainIds).toEqual([1]);
    expect(view.walletFilters).toEqual([
      {
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        nodeIds: ["wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        label: "0xaaaa...aaaa",
      },
      {
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        nodeIds: ["wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
        label: "0xbbbb...bbbb",
      },
    ]);
    expect(view.nodes.find((node) => node.id.endsWith("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))).toMatchObject({
      role: "watched",
      shortLabel: "0xaaaa...aaaa",
      degree: 2,
      metrics: {
        degree: 2,
        incomingCount: 0,
        outgoingCount: 2,
        findingCount: 1,
      },
      visual: {
        size: 48,
        colorToken: "wallet-watched",
        icon: "wallet",
      },
    });
    expect(view.nodes.find((node) => node.kind === "contract")).toMatchObject({
      role: "contract",
      metrics: {
        degree: 1,
        incomingCount: 1,
        outgoingCount: 0,
        findingCount: 0,
      },
    });
    expect(view.edges[0]).toMatchObject({
      id: "edge:direct",
      direction: "directed",
      label: "native_transfer · 2 tx",
      findingIds: ["finding:direct"],
      metrics: {
        eventCount: 2,
      },
    });
  });
});
