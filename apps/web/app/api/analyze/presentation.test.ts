import type { Finding, RelationshipGraph } from "@wallet-map/core";
import { describe, expect, it } from "vitest";
import { buildPresentationGraph, buildPresentationSummary } from "./presentation";

describe("buildPresentationGraph", () => {
  it("keeps only edges referenced by findings", () => {
    const graph: RelationshipGraph = {
      nodes: [
        { id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", kind: "wallet" },
        { id: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", kind: "wallet" },
        { id: "wallet:1:0xcccccccccccccccccccccccccccccccccccccccc", kind: "wallet" },
      ],
      edges: [
        {
          id: "edge:1",
          kind: "native_transfer",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          weight: 1,
          evidenceEventIds: ["event:1"],
        },
        {
          id: "edge:2",
          kind: "native_transfer",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xcccccccccccccccccccccccccccccccccccccccc",
          weight: 1,
          evidenceEventIds: ["event:2"],
        },
      ],
    };
    const findings = [
      {
        id: "finding:1",
        analyzerId: "direct-transfer",
        title: "Direct transfer found",
        description: "",
        severity: "high",
        confidence: "high",
        scoreImpact: 40,
        evidence: [],
        metadata: {
          edgeId: "edge:1",
        },
      },
    ] as Finding[];

    const presentation = buildPresentationGraph(graph, findings);

    expect(presentation.graph.edges).toHaveLength(1);
    expect(presentation.graph.edges[0]?.id).toBe("edge:1");
    expect(presentation.graph.nodes).toHaveLength(2);
  });

  it("aggregates repeated edges between the same nodes into one presentation edge", () => {
    const graph: RelationshipGraph = {
      nodes: [
        { id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", kind: "wallet" },
        { id: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", kind: "wallet" },
      ],
      edges: [
        {
          id: "edge:1",
          kind: "native_transfer",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          weight: 1,
          evidenceEventIds: ["event:1"],
          metadata: {
            chainId: 1,
            amount: "100",
            asset: {
              kind: "native",
            },
          },
        },
        {
          id: "edge:2",
          kind: "native_transfer",
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          weight: 1,
          evidenceEventIds: ["event:2"],
          metadata: {
            chainId: 1,
            amount: "200",
            asset: {
              kind: "native",
            },
          },
        },
      ],
    };
    const findings = [
      {
        id: "finding:1",
        analyzerId: "direct-transfer",
        title: "Direct transfer found",
        description: "",
        severity: "high",
        confidence: "high",
        scoreImpact: 40,
        evidence: [],
        metadata: {
          edgeIds: ["edge:1", "edge:2"],
        },
      },
    ] as Finding[];

    const presentation = buildPresentationGraph(graph, findings);

    expect(presentation.graph.edges).toHaveLength(1);
    expect(presentation.graph.edges[0]?.evidenceEventIds).toEqual(["event:1", "event:2"]);
    expect(presentation.graph.edges[0]?.metadata).toMatchObject({
      txCount: 2,
    });
  });
});

describe("buildPresentationSummary", () => {
  it("classifies direct transfer pairs as strong", () => {
    const graph: RelationshipGraph = {
      nodes: [
        {
          id: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          kind: "wallet",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          tags: ["watched"],
        },
        {
          id: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          kind: "wallet",
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          tags: ["watched"],
        },
      ],
      edges: [],
    };
    const findings = [
      {
        id: "finding:1",
        analyzerId: "direct-transfer",
        title: "Direct transfer found",
        description: "",
        severity: "high",
        confidence: "high",
        scoreImpact: 40,
        evidence: [],
        metadata: {
          source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
    ] as Finding[];

    const summary = buildPresentationSummary(findings, graph);

    expect(summary.verdict).toBe("strong");
    expect(summary.pairInsights[0]?.strength).toBe("strong");
    expect(summary.pairInsights[0]?.labels).toEqual(["0xaaaa...aaaa", "0xbbbb...bbbb"]);
  });
});
