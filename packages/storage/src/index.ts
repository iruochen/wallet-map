import type {
  Address,
  AnalysisRunResult,
  ChainId,
  Finding,
  GraphEdge,
  GraphNode,
  NormalizedEvent,
  RelationshipScore,
} from "@wallet-map/core";

export const STORAGE_MIGRATIONS = ["0001_initial_schema.sql"] as const;

export type AnalysisJobStatus = "pending" | "running" | "completed" | "failed";

export interface AnalysisJobRecord {
  id: string;
  status: AnalysisJobStatus;
  subjectId?: string;
  inputAddresses: Address[];
  chainIds: ChainId[];
  score?: RelationshipScore;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CreateAnalysisJobInput {
  id?: string;
  subjectId?: string;
  inputAddresses: Address[];
  chainIds: ChainId[];
}

export interface StoredAnalysisRun {
  job: AnalysisJobRecord;
  events: NormalizedEvent[];
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  findings: Finding[];
}

export interface SaveAnalysisRunInput {
  jobId: string;
  events: NormalizedEvent[];
  result: AnalysisRunResult;
}

export interface AnalysisJobRepository {
  create(input: CreateAnalysisJobInput): Promise<AnalysisJobRecord>;
  findById(jobId: string): Promise<AnalysisJobRecord | undefined>;
  markRunning(jobId: string, startedAt: string): Promise<void>;
  markCompleted(jobId: string, score: RelationshipScore, completedAt: string): Promise<void>;
  markFailed(jobId: string, errorMessage: string, failedAt: string): Promise<void>;
}

export interface AnalysisRunRepository {
  save(input: SaveAnalysisRunInput): Promise<void>;
  findByJobId(jobId: string): Promise<StoredAnalysisRun | undefined>;
}

export interface WalletMapStorage {
  jobs: AnalysisJobRepository;
  runs: AnalysisRunRepository;
}
