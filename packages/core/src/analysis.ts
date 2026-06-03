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

export interface GraphEnricher {
  id: string;
  enrich(graph: RelationshipGraph, events: NormalizedEvent[]): Promise<RelationshipGraph>;
}

export type AnalysisPipelinePhase = "graph" | "labels" | "analysis";

export interface AnalysisProgressUpdate {
  phase: AnalysisPipelinePhase;
  status: "started" | "completed";
}

export interface AnalysisRunInput {
  watchedAddresses: Address[];
  events: NormalizedEvent[];
  analyzers: Analyzer[];
  graphEnrichers?: GraphEnricher[];
  onProgress?: (update: AnalysisProgressUpdate) => void;
}

export interface AnalysisRunResult {
  graph: RelationshipGraph;
  findings: Finding[];
  score: RelationshipScore;
}

export async function runAnalysis(input: AnalysisRunInput): Promise<AnalysisRunResult> {
  input.onProgress?.({ phase: "graph", status: "started" });
  let graph = buildRelationshipGraph({
    watchedAddresses: input.watchedAddresses,
    events: input.events,
  });
  input.onProgress?.({ phase: "graph", status: "completed" });

  const enrichers = input.graphEnrichers ?? [];
  if (enrichers.length > 0) {
    input.onProgress?.({ phase: "labels", status: "started" });
    for (const enricher of enrichers) {
      graph = await enricher.enrich(graph, input.events);
    }
    input.onProgress?.({ phase: "labels", status: "completed" });
  }

  input.onProgress?.({ phase: "analysis", status: "started" });
  const context: AnalysisContext = {
    graph,
    events: input.events,
  };
  const findings = (
    await Promise.all(input.analyzers.map((analyzer) => analyzer.run(context)))
  ).flat();
  const score = scoreFindings(findings);
  input.onProgress?.({ phase: "analysis", status: "completed" });

  return {
    graph,
    findings,
    score,
  };
}
