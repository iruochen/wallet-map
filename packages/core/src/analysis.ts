import type { NormalizedEvent } from "./models";
import type { RelationshipGraph } from "./graph";

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
