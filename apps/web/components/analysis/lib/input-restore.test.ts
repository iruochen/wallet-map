import { describe, expect, it } from "vitest";
import type { AnalysisResponse } from "../types";
import { deriveWorkbenchInputFromResult } from "./input-restore";

const evmAggregateChainIds = [1, 42161, 8453, 10, 137, 56];

const baseResult: AnalysisResponse = {
  mode: "fixture",
  source: "fixtures/sample-events.json",
  sourceLabel: "Fixture data",
  meta: {
    chainId: 1,
    chainIds: [1],
    chainName: "Ethereum",
    requestedMode: "fixture",
    resolvedMode: "fixture",
    dataProvider: "auto",
    watchedAddressCount: 2,
    eventCount: 1,
    graphWalletCount: 2,
    graphContractCount: 0,
    fetchedAt: "2024-01-02T03:04:05.000Z",
  },
  score: {
    score: 40,
    confidence: "high",
    dimensions: {
      funding: 40,
      destination: 0,
      contract: 0,
      temporal: 0,
      asset: 0,
    },
    topSignals: [],
    reasons: [],
    counterEvidence: [],
  },
  summary: {
    verdict: "strong",
    headline: "Headline",
    narrative: "Narrative",
    pairInsights: [],
    signalHighlights: [],
  },
  graph: {
    totalNodes: 2,
    totalEdges: 1,
    nodesTruncated: false,
    edgesTruncated: false,
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
    ],
    edges: [],
  },
  findings: [],
};

describe("deriveWorkbenchInputFromResult", () => {
  it("restores addresses and chain from saved input", () => {
    const result: AnalysisResponse = {
      ...baseResult,
      input: {
        addresses: [
          "0xcccccccccccccccccccccccccccccccccccccccc",
          "0xdddddddddddddddddddddddddddddddddddddddd",
        ],
        chainId: 56,
        chainIds: [56],
        dataMode: "live",
        dataProvider: "nodereal",
      },
    };

    expect(deriveWorkbenchInputFromResult(result, evmAggregateChainIds)).toEqual({
      addresses: "0xcccccccccccccccccccccccccccccccccccccccc\n0xdddddddddddddddddddddddddddddddddddddddd",
      chainId: "56",
      dataMode: "live",
      dataProvider: "nodereal",
    });
  });

  it("maps EVM ALL selection back to aggregate chain id", () => {
    const result: AnalysisResponse = {
      ...baseResult,
      meta: {
        ...baseResult.meta,
        chainId: 0,
        chainIds: evmAggregateChainIds,
        chainName: "EVM",
      },
      input: {
        addresses: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        chainId: 0,
        chainIds: evmAggregateChainIds,
        dataMode: "auto",
        dataProvider: "auto",
      },
    };

    expect(deriveWorkbenchInputFromResult(result, evmAggregateChainIds)).toMatchObject({
      chainId: "0",
      dataMode: "auto",
    });
  });

  it("falls back to watched graph nodes when input is missing", () => {
    expect(deriveWorkbenchInputFromResult(baseResult, evmAggregateChainIds)).toEqual({
      addresses:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      chainId: "1",
      dataMode: "fixture",
      dataProvider: "auto",
    });
  });
});
