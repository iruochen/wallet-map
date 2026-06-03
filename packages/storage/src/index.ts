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

export const STORAGE_MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_analysis_job_metadata.sql",
] as const;

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

export interface KnownLabelRecord {
  id: string;
  nodeKind: GraphNode["kind"];
  chainId: ChainId;
  address: Address;
  label: string;
  entity?: string;
  category?: string;
  tags: string[];
  source: string;
  confidence?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  metadata?: Record<string, unknown>;
}

export interface LabelLookupInput {
  chainId: ChainId;
  addresses: Address[];
  nodeKinds?: Array<GraphNode["kind"]>;
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

export interface LabelRepository {
  findKnownLabels(input: LabelLookupInput): Promise<KnownLabelRecord[]>;
  upsertKnownLabels(labels: KnownLabelRecord[]): Promise<void>;
}

export interface WalletMapStorage {
  jobs: AnalysisJobRepository;
  runs: AnalysisRunRepository;
  labels?: LabelRepository;
}

export { createPostgresLabelRepository } from "./postgres-labels";
export type { PostgresLabelRepositoryOptions } from "./postgres-labels";
export { createPostgresAnalysisStorage } from "./postgres-analysis";
export type {
  AnalysisJobListItem,
  AnalysisJobProgressSnapshot,
  CreatePersistedAnalysisJobInput,
  PersistAnalysisRunInput,
  PostgresAnalysisStorage,
} from "./postgres-analysis";
