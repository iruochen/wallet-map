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
      reasons: ["Direct transfer found"],
      counterEvidence: [],
    });
  });
});
