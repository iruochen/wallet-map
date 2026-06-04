import type { Pool } from "pg";
import type {
  AnalysisRunResult,
  Finding,
  GraphEdge,
  GraphNode,
  NormalizedEvent,
  RelationshipScore,
} from "@wallet-map/core";
import type { Address, ChainId } from "@wallet-map/core";
import type { AnalysisJobStatus } from "./index";

export interface AnalysisJobProgressSnapshot {
  phase: "fetch" | "graph" | "labels" | "analysis" | null;
  completedPhases: Array<"fetch" | "graph" | "labels" | "analysis">;
}

export interface CreatePersistedAnalysisJobInput {
  id: string;
  subjectId?: string;
  inputAddresses: Address[];
  chainIds: ChainId[];
  dataMode?: string;
  chainName?: string;
  sourceLabel?: string;
}

export interface AnalysisJobListItem {
  id: string;
  status: AnalysisJobStatus;
  chainName?: string;
  sourceLabel?: string;
  dataMode?: string;
  watchedAddressCount?: number;
  eventCount?: number;
  score?: RelationshipScore;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface PersistAnalysisRunInput {
  jobId: string;
  events: NormalizedEvent[];
  result: AnalysisRunResult;
  responseSnapshot: unknown;
  chainName?: string;
  sourceLabel?: string;
  dataMode?: string;
}

export interface PostgresAnalysisStorage {
  createJob(input: CreatePersistedAnalysisJobInput): Promise<void>;
  updateJobProgress(jobId: string, progress: AnalysisJobProgressSnapshot): Promise<void>;
  markJobRunning(jobId: string): Promise<void>;
  markJobFailed(jobId: string, errorMessage: string): Promise<void>;
  saveCompletedRun(input: PersistAnalysisRunInput): Promise<void>;
  getJobRecord(jobId: string, subjectId?: string): Promise<{
    status: AnalysisJobStatus;
    progress?: AnalysisJobProgressSnapshot;
    errorMessage?: string;
    resultSnapshot?: unknown;
  } | undefined>;
  listJobs(limit?: number, subjectId?: string): Promise<AnalysisJobListItem[]>;
}

export function createPostgresAnalysisStorage(pool: Pool): PostgresAnalysisStorage {
  return {
    createJob,
    updateJobProgress,
    markJobRunning,
    markJobFailed,
    saveCompletedRun,
    getJobRecord,
    listJobs,
  };

  async function createJob(input: CreatePersistedAnalysisJobInput): Promise<void> {
    const now = new Date().toISOString();

    await pool.query(
      `
        INSERT INTO analysis_jobs (
          id,
          status,
          subject_id,
          input_addresses,
          chain_ids,
          data_mode,
          chain_name,
          source_label,
          watched_address_count,
          progress,
          created_at,
          updated_at
        )
        VALUES ($1, 'pending', $2, $3::jsonb, $4::int[], $5, $6, $7, $8, $9::jsonb, $10, $10)
      `,
      [
        input.id,
        input.subjectId ?? null,
        JSON.stringify(input.inputAddresses),
        input.chainIds,
        input.dataMode ?? null,
        input.chainName ?? null,
        input.sourceLabel ?? null,
        input.inputAddresses.length,
        JSON.stringify({ phase: null, completedPhases: [] }),
        now,
      ],
    );
  }

  async function updateJobProgress(jobId: string, progress: AnalysisJobProgressSnapshot): Promise<void> {
    await pool.query(
      `
        UPDATE analysis_jobs
        SET progress = $2::jsonb, updated_at = now()
        WHERE id = $1
      `,
      [jobId, JSON.stringify(progress)],
    );
  }

  async function markJobRunning(jobId: string): Promise<void> {
    await pool.query(
      `
        UPDATE analysis_jobs
        SET status = 'running', started_at = COALESCE(started_at, now()), updated_at = now()
        WHERE id = $1
      `,
      [jobId],
    );
  }

  async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    await pool.query(
      `
        UPDATE analysis_jobs
        SET status = 'failed', error_message = $2, updated_at = now()
        WHERE id = $1
      `,
      [jobId, errorMessage],
    );
  }

  async function saveCompletedRun(input: PersistAnalysisRunInput): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          UPDATE analysis_jobs
          SET
            status = 'completed',
            score = $2::jsonb,
            result_snapshot = $3::jsonb,
            chain_name = COALESCE($4, chain_name),
            source_label = COALESCE($5, source_label),
            data_mode = COALESCE($6, data_mode),
            watched_address_count = $7,
            event_count = $8,
            progress = $9::jsonb,
            completed_at = now(),
            updated_at = now(),
            error_message = NULL
          WHERE id = $1
        `,
        [
          input.jobId,
          JSON.stringify(input.result.score),
          JSON.stringify(input.responseSnapshot),
          input.chainName ?? null,
          input.sourceLabel ?? null,
          input.dataMode ?? null,
          countWatchedWallets(input.result.graph.nodes),
          input.events.length,
          JSON.stringify({
            phase: null,
            completedPhases: ["fetch", "graph", "labels", "analysis"],
          }),
        ],
      );

      await client.query(`DELETE FROM normalized_events WHERE analysis_job_id = $1`, [input.jobId]);
      await client.query(`DELETE FROM graph_edges WHERE analysis_job_id = $1`, [input.jobId]);
      await client.query(`DELETE FROM graph_nodes WHERE analysis_job_id = $1`, [input.jobId]);
      await client.query(`DELETE FROM findings WHERE analysis_job_id = $1`, [input.jobId]);

      for (const event of input.events) {
        await client.query(
          `
            INSERT INTO normalized_events (
              id,
              analysis_job_id,
              event_type,
              chain_id,
              tx_hash,
              block_number,
              occurred_at,
              from_address,
              to_address,
              contract_address,
              method_id,
              asset,
              amount,
              metadata,
              raw_event
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14::jsonb, $15::jsonb)
          `,
          [
            event.id,
            input.jobId,
            event.type,
            event.chainId,
            event.txHash,
            event.blockNumber,
            event.timestamp,
            event.from ?? null,
            event.to ?? null,
            event.contract ?? null,
            event.methodId ?? null,
            event.asset ? JSON.stringify(event.asset) : null,
            event.amount ?? null,
            event.metadata ? JSON.stringify(event.metadata) : null,
            JSON.stringify(event),
          ],
        );
      }

      for (const node of input.result.graph.nodes) {
        await client.query(
          `
            INSERT INTO graph_nodes (
              id,
              analysis_job_id,
              node_kind,
              address,
              chain_id,
              label,
              tags,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb)
          `,
          [
            node.id,
            input.jobId,
            node.kind,
            node.address ?? null,
            node.chainId ?? null,
            node.label ?? null,
            node.tags ?? [],
            node.metadata ? JSON.stringify(node.metadata) : null,
          ],
        );
      }

      for (const edge of input.result.graph.edges) {
        await client.query(
          `
            INSERT INTO graph_edges (
              id,
              analysis_job_id,
              edge_kind,
              source_node_id,
              target_node_id,
              weight,
              evidence_event_ids,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8::jsonb)
          `,
          [
            edge.id,
            input.jobId,
            edge.kind,
            edge.source,
            edge.target,
            edge.weight,
            edge.evidenceEventIds,
            edge.metadata ? JSON.stringify(edge.metadata) : null,
          ],
        );
      }

      for (const finding of input.result.findings) {
        await insertFinding(client, input.jobId, finding);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function getJobRecord(jobId: string, subjectId?: string) {
    const result = await pool.query<{
      status: AnalysisJobStatus;
      progress: AnalysisJobProgressSnapshot | null;
      error_message: string | null;
      result_snapshot: unknown;
    }>(
      `
        SELECT status, progress, error_message, result_snapshot
        FROM analysis_jobs
        WHERE id = $1 AND ($2::text IS NULL OR subject_id = $2)
      `,
      [jobId, subjectId ?? null],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return {
      status: row.status,
      progress: row.progress ?? undefined,
      errorMessage: row.error_message ?? undefined,
      resultSnapshot: row.result_snapshot ?? undefined,
    };
  }

  async function listJobs(limit = 20, subjectId?: string): Promise<AnalysisJobListItem[]> {
    const result = await pool.query<{
      id: string;
      status: AnalysisJobStatus;
      chain_name: string | null;
      source_label: string | null;
      data_mode: string | null;
      watched_address_count: number | null;
      event_count: number | null;
      score: RelationshipScore | null;
      created_at: Date | string;
      completed_at: Date | string | null;
      error_message: string | null;
    }>(
      `
        SELECT
          id,
          status,
          chain_name,
          source_label,
          data_mode,
          watched_address_count,
          event_count,
          score,
          created_at,
          completed_at,
          error_message
        FROM analysis_jobs
        WHERE ($2::text IS NULL OR subject_id = $2)
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit, subjectId ?? null],
    );

    return result.rows.map((row) => ({
      id: row.id,
      status: row.status,
      chainName: row.chain_name ?? undefined,
      sourceLabel: row.source_label ?? undefined,
      dataMode: row.data_mode ?? undefined,
      watchedAddressCount: row.watched_address_count ?? undefined,
      eventCount: row.event_count ?? undefined,
      score: row.score ?? undefined,
      createdAt: new Date(row.created_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      errorMessage: row.error_message ?? undefined,
    }));
  }
}

async function insertFinding(
  client: { query: Pool["query"] },
  jobId: string,
  finding: Finding,
): Promise<void> {
  await client.query(
    `
      INSERT INTO findings (
        id,
        analysis_job_id,
        analyzer_id,
        title,
        description,
        severity,
        confidence,
        score_impact,
        evidence,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
    `,
    [
      finding.id,
      jobId,
      finding.analyzerId,
      finding.title,
      finding.description,
      finding.severity,
      finding.confidence,
      finding.scoreImpact,
      JSON.stringify(finding.evidence),
      finding.metadata ? JSON.stringify(finding.metadata) : null,
    ],
  );
}

function countWatchedWallets(nodes: GraphNode[]): number {
  return nodes.filter((node) => node.kind === "wallet" && node.tags?.includes("watched")).length;
}
