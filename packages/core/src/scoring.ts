import type { Finding } from "./analysis";

export interface RelationshipScoreDimensions {
  funding: number;
  destination: number;
  contract: number;
  temporal: number;
  asset: number;
}

export interface RelationshipScore {
  score: number;
  confidence: "low" | "medium" | "high";
  dimensions: RelationshipScoreDimensions;
  topSignals: string[];
  reasons: string[];
  counterEvidence: string[];
}

type ScoreDimension = keyof RelationshipScoreDimensions;

const emptyDimensions: RelationshipScoreDimensions = {
  funding: 0,
  destination: 0,
  contract: 0,
  temporal: 0,
  asset: 0,
};

export function scoreFindings(findings: Finding[]): RelationshipScore {
  const dimensions = scoreDimensions(findings);
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
    dimensions,
    topSignals: buildTopSignals(findings),
    reasons: findings.map((finding) => finding.title),
    counterEvidence: buildCounterEvidence(findings),
  };
}

function scoreDimensions(findings: Finding[]): RelationshipScoreDimensions {
  const dimensions = { ...emptyDimensions };

  for (const finding of findings) {
    for (const dimension of getFindingDimensions(finding)) {
      dimensions[dimension] = Math.min(100, dimensions[dimension] + finding.scoreImpact);
    }
  }

  return dimensions;
}

function getFindingDimensions(finding: Finding): ScoreDimension[] {
  switch (finding.analyzerId) {
    case "direct-transfer":
    case "shared-funding-source":
    case "multi-hop-path":
      return ["funding"];
    case "shared-withdrawal-destination":
    case "shared-counterparty":
    case "bridge-correlation":
      return ["destination"];
    case "same-contract-interaction":
      return ["contract"];
    case "temporal-pattern":
      return ["temporal"];
    default:
      return ["asset"];
  }
}

function buildTopSignals(findings: Finding[]): string[] {
  return [...findings]
    .sort((left, right) => right.scoreImpact - left.scoreImpact || left.title.localeCompare(right.title))
    .slice(0, 5)
    .map((finding) => finding.title);
}

function buildCounterEvidence(findings: Finding[]): string[] {
  const counterEvidence = new Set<string>();

  if (findings.length === 0) {
    counterEvidence.add("No relationship findings were produced from the available events.");
  }

  if (findings.some((finding) => finding.confidence === "low")) {
    counterEvidence.add("Some findings are low confidence and require manual review.");
  }

  if (findings.some((finding) => Boolean(finding.metadata?.publicEntity))) {
    counterEvidence.add("One or more signals involve a labelled public entity and were downweighted.");
  }

  if (findings.some((finding) => Boolean(finding.metadata?.publicEntityPath))) {
    counterEvidence.add("One or more transfer paths pass through a labelled public intermediary.");
  }

  return Array.from(counterEvidence);
}
