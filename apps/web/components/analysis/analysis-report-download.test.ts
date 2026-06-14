import { describe, expect, it } from "vitest";
import type { AnalysisResponse } from "./analysis-types";
import {
  buildEvidenceCsv,
  buildReportDownloadBlob,
  buildReportDownloadFilename,
} from "./analysis-report-download";

const response: AnalysisResponse = {
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
    topSignals: ["Direct transfer found"],
    reasons: ["Direct transfer found"],
    counterEvidence: [],
  },
  summary: {
    verdict: "strong",
    headline: "发现 1 组高价值关联。",
    narrative: "两个 watched wallets 命中直接转账信号。",
    pairInsights: [
      {
        id: "pair-1",
        wallets: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        labels: ["0xaaaa...aaaa", "0xbbbb...bbbb"],
        strength: "strong",
        score: 40,
        confidence: "high",
        signalCount: 1,
        reasons: ["Direct transfer found"],
        chainIds: [1],
      },
    ],
    signalHighlights: [{ analyzerId: "direct-transfer", title: "Direct transfer found", count: 1 }],
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
    edges: [
      {
        id: "edge-1",
        kind: "native_transfer",
        source: "wallet:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target: "wallet:1:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        weight: 1,
        evidenceEventIds: ["event-1"],
      },
    ],
  },
  findings: [
    {
      id: "finding-1",
      analyzerId: "direct-transfer",
      title: "Direct transfer found",
      description:
        "Wallet 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa transferred value directly to 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
      severity: "high",
      confidence: "high",
      scoreImpact: 40,
      evidenceTotal: 1,
      evidenceTruncated: false,
      evidence: [
        {
          eventId: "event-1",
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          summary:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa sent native value to 0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.",
          event: {
            type: "native_transfer",
            chainId: 1,
            txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
            blockNumber: 12345,
            timestamp: "2024-01-02T03:04:05.000Z",
          },
        },
      ],
    },
  ],
};

describe("analysis report downloads", () => {
  it("builds stable report filenames by format", () => {
    expect(buildReportDownloadFilename(response, "pdf")).toBe("wallet-map-2024-01-02.pdf");
    expect(buildReportDownloadFilename(response, "markdown")).toBe("wallet-map-2024-01-02.md");
    expect(buildReportDownloadFilename(response, "json")).toBe("wallet-map-2024-01-02.json");
    expect(buildReportDownloadFilename(response, "csv")).toBe("wallet-map-2024-01-02.csv");
  });

  it("builds Markdown report blobs", async () => {
    const blob = await buildReportDownloadBlob(response, "markdown");
    const text = await blob.text();

    expect(blob.type).toBe("text/markdown;charset=utf-8");
    expect(text).toContain("# Wallet Map 链上关联分析报告");
    expect(text).toContain("Direct transfer found");
  });

  it("builds JSON report blobs", async () => {
    const blob = await buildReportDownloadBlob(response, "json");
    const parsed = JSON.parse(await blob.text()) as { schemaVersion: string; title: string };

    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(parsed.schemaVersion).toBe("1.1");
    expect(parsed.title).toBe("Wallet Map 链上关联分析报告");
  });

  it("builds CSV evidence blobs", async () => {
    const blob = await buildReportDownloadBlob(response, "csv");
    const text = await blob.text();

    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(text.split("\n")[0]).toBe(
      "finding_id,analyzer_id,finding_title,severity,confidence,score_impact,event_id,tx_hash,chain_id,block_number,timestamp,event_type,from,to,contract,method_id,amount,asset_symbol,summary",
    );
    expect(text).toContain("finding-1,direct-transfer,Direct transfer found,high,high,40,event-1");
    expect(text).toContain("0x1111111111111111111111111111111111111111111111111111111111111111");
  });

  it("escapes CSV cells that contain commas or quotes", () => {
    const csv = buildEvidenceCsv({
      ...response,
      findings: [
        {
          ...response.findings[0],
          title: 'Quoted, finding',
          evidence: [
            {
              ...response.findings[0].evidence[0],
              summary: 'Wallet "A", sent value',
            },
          ],
        },
      ],
    });

    expect(csv).toContain('"Quoted, finding"');
    expect(csv).toContain('"Wallet ""A"", sent value"');
  });
});
