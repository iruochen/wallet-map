import { describe, expect, it } from "vitest";
import { scoreFindings } from "./scoring";
import type { Finding } from "./analysis";

describe("scoreFindings", () => {
  it("sums score impact and explains reasons", () => {
    const findings: Finding[] = [
      {
        id: "finding-1",
        analyzerId: "direct-transfer",
        title: "Direct transfer found",
        description: "Wallets transferred value directly.",
        severity: "high",
        confidence: "high",
        scoreImpact: 40,
        evidence: [],
      },
    ];

    expect(scoreFindings(findings)).toEqual({
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
    });
  });

  it("builds multidimensional exposure scores from analyzer ids", () => {
    const findings: Finding[] = [
      buildFinding({
        id: "funding",
        analyzerId: "shared-funding-source",
        title: "Shared funding source found",
        scoreImpact: 30,
        confidence: "medium",
      }),
      buildFinding({
        id: "destination",
        analyzerId: "shared-withdrawal-destination",
        title: "Shared withdrawal destination found",
        scoreImpact: 26,
        confidence: "medium",
      }),
      buildFinding({
        id: "contract",
        analyzerId: "same-contract-interaction",
        title: "Same contract interaction found",
        scoreImpact: 6,
        confidence: "low",
        metadata: {
          publicEntity: true,
        },
      }),
      buildFinding({
        id: "temporal",
        analyzerId: "temporal-pattern",
        title: "Temporal pattern found",
        scoreImpact: 15,
        confidence: "medium",
      }),
      buildFinding({
        id: "bridge",
        analyzerId: "bridge-correlation",
        title: "Bridge correlation found",
        scoreImpact: 22,
        confidence: "medium",
      }),
    ];

    expect(scoreFindings(findings)).toEqual({
      score: 99,
      confidence: "medium",
      dimensions: {
        funding: 30,
        destination: 48,
        contract: 6,
        temporal: 15,
        asset: 0,
      },
      topSignals: [
        "Shared funding source found",
        "Shared withdrawal destination found",
        "Bridge correlation found",
        "Temporal pattern found",
        "Same contract interaction found",
      ],
      reasons: [
        "Shared funding source found",
        "Shared withdrawal destination found",
        "Same contract interaction found",
        "Temporal pattern found",
        "Bridge correlation found",
      ],
      counterEvidence: [
        "Some findings are low confidence and require manual review.",
        "One or more signals involve a labelled public entity and were downweighted.",
      ],
    });
  });

  it("caps total and dimension scores at 100", () => {
    const findings: Finding[] = [
      buildFinding({
        id: "funding-1",
        analyzerId: "direct-transfer",
        title: "Direct transfer found",
        scoreImpact: 80,
        confidence: "high",
      }),
      buildFinding({
        id: "funding-2",
        analyzerId: "multi-hop-path",
        title: "Multi-hop transfer path found",
        scoreImpact: 80,
        confidence: "medium",
      }),
    ];

    expect(scoreFindings(findings)).toMatchObject({
      score: 100,
      confidence: "high",
      dimensions: {
        funding: 100,
        destination: 0,
        contract: 0,
        temporal: 0,
        asset: 0,
      },
    });
  });

  it("explains when no findings are present", () => {
    expect(scoreFindings([])).toEqual({
      score: 0,
      confidence: "low",
      dimensions: {
        funding: 0,
        destination: 0,
        contract: 0,
        temporal: 0,
        asset: 0,
      },
      topSignals: [],
      reasons: [],
      counterEvidence: ["No relationship findings were produced from the available events."],
    });
  });
});

function buildFinding(input: {
  id: string;
  analyzerId: string;
  title: string;
  scoreImpact: number;
  confidence: Finding["confidence"];
  metadata?: Finding["metadata"];
}): Finding {
  return {
    id: input.id,
    analyzerId: input.analyzerId,
    title: input.title,
    description: input.title,
    severity: "medium",
    confidence: input.confidence,
    scoreImpact: input.scoreImpact,
    evidence: [],
    metadata: input.metadata,
  };
}
