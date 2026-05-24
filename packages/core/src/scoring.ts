import type { Finding } from "./analysis";

export interface RelationshipScore {
  score: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  counterEvidence: string[];
}

export function scoreFindings(findings: Finding[]): RelationshipScore {
  const score = Math.min(
    100,
    Math.max(
      0,
      findings.reduce((total, finding) => total + finding.scoreImpact, 0),
    ),
  );

  const highConfidenceCount = findings.filter((finding) => finding.confidence === "high").length;
  const confidence = highConfidenceCount > 0 ? "high" : findings.length > 1 ? "medium" : "low";

  return {
    score,
    confidence,
    reasons: findings.map((finding) => finding.title),
    counterEvidence: [],
  };
}
