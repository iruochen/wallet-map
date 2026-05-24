import type { NormalizedEvent } from "./models";
import type { RelationshipGraph } from "./graph";
import { buildRelationshipGraph } from "./graph";
import { scoreFindings, type RelationshipScore } from "./scoring";
import type { Address } from "./models";

export type FindingSeverity = "info" | "low" | "medium" | "high";
export type FindingConfidence = "low" | "medium" | "high";

export interface EvidenceRef {
  eventId: string;
  txHash?: string;
  summary: string;
}

export interface Finding {
  id: string;
  analyzerId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  scoreImpact: number;
  evidence: EvidenceRef[];
  metadata?: Record<string, unknown>;
}

export interface AnalysisContext {
  graph: RelationshipGraph;
  events: NormalizedEvent[];
}

export interface Analyzer {
  id: string;
  name: string;
  run(context: AnalysisContext): Promise<Finding[]>;
}

export interface AnalysisRunInput {
  watchedAddresses: Address[];
  events: NormalizedEvent[];
  analyzers: Analyzer[];
}

export interface AnalysisRunResult {
  graph: RelationshipGraph;
  findings: Finding[];
  score: RelationshipScore;
}

export async function runAnalysis(input: AnalysisRunInput): Promise<AnalysisRunResult> {
  const graph = buildRelationshipGraph({
    watchedAddresses: input.watchedAddresses,
    events: input.events,
  });
  const context: AnalysisContext = {
    graph,
    events: input.events,
  };
  const findings = (
    await Promise.all(input.analyzers.map((analyzer) => analyzer.run(context)))
  ).flat();

  return {
    graph,
    findings,
    score: scoreFindings(findings),
  };
}
