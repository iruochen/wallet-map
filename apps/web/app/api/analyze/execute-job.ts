import { createDefaultAnalyzers } from "@wallet-map/analyzers";
import type { AnalysisPipelinePhase } from "@wallet-map/core";
import { runAnalysis } from "@wallet-map/core";
import { createLabelGraphEnricher } from "@wallet-map/labels";
import { getAnalysisStorage } from "./analysis-storage";
import { buildAnalyzeResponse } from "./build-response";
import { resolveAnalyzeEvents } from "./data-source";
import { warmWalletLabelCache, persistDiscoveredGraphLabels } from "./label-cache";
import {
  createAnalyzeJob,
  getAnalyzeJob,
  markAnalyzeJobCompleted,
  markAnalyzeJobFailed,
  markAnalyzeJobPhaseCompleted,
  markAnalyzeJobPhaseStarted,
  markAnalyzeJobRunning,
} from "./job-store";
import { createAnalyzeLabelStack } from "./label-providers";
import type { AnalysisPhaseId } from "./progress";
import type { ParsedAnalyzeRequest } from "./schema";

function mapPipelinePhase(phase: AnalysisPipelinePhase): AnalysisPhaseId {
  return phase;
}

export function startAnalyzeJob(parsed: ParsedAnalyzeRequest): string {
  const jobId = crypto.randomUUID();
  void initializeAndExecuteAnalyzeJob(jobId, parsed);
  return jobId;
}

async function initializeAndExecuteAnalyzeJob(
  jobId: string,
  parsed: ParsedAnalyzeRequest,
): Promise<void> {
  const storage = await getAnalysisStorage();

  try {
    await createAnalyzeJob(jobId);

    if (storage) {
      await storage.createJob({
        id: jobId,
        inputAddresses: parsed.addresses,
        chainIds: parsed.chainIds,
        dataMode: parsed.dataMode,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize analysis job.";
    await markAnalyzeJobFailed(jobId, message);
    await storage?.markJobFailed(jobId, message).catch(() => undefined);
    return;
  }

  await executeAnalyzeJob(jobId, parsed);
}

export async function executeAnalyzeJob(jobId: string, parsed: ParsedAnalyzeRequest): Promise<void> {
  const existingJob = await getAnalyzeJob(jobId);
  if (!existingJob) {
    return;
  }

  const storage = await getAnalysisStorage();

  await markAnalyzeJobRunning(jobId);
  await storage?.markJobRunning(jobId).catch(() => undefined);

  try {
    await syncJobProgress(jobId, "fetch", "started", storage);
    const resolved = await resolveAnalyzeEvents(parsed);
    await syncJobProgress(jobId, "fetch", "completed", storage);

    const labelStack = createAnalyzeLabelStack();
    const result = await runAnalysis({
      watchedAddresses: parsed.addresses,
      events: resolved.events,
      analyzers: createDefaultAnalyzers(),
      graphEnrichers: [
        createLabelGraphEnricher({
          providers: labelStack.providers,
        }),
      ],
      onProgress: async (update) => {
        const phase = mapPipelinePhase(update.phase);

        if (phase === "labels" && update.status === "started") {
          await warmWalletLabelCache(parsed.addresses, parsed.chainIds);
        }

        await syncJobProgress(jobId, phase, update.status === "started" ? "started" : "completed", storage);
      },
    });

    await persistDiscoveredGraphLabels(result.graph);

    const response = buildAnalyzeResponse(parsed, resolved, result);
    await markAnalyzeJobCompleted(jobId, response);

    if (storage) {
      await storage.saveCompletedRun({
        jobId,
        events: resolved.events,
        result,
        responseSnapshot: response,
        chainName: resolved.chainName,
        sourceLabel: response.sourceLabel,
        dataMode: parsed.dataMode,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    await markAnalyzeJobFailed(jobId, message);
    await storage?.markJobFailed(jobId, message).catch(() => undefined);
  }
}

async function syncJobProgress(
  jobId: string,
  phase: AnalysisPhaseId,
  status: "started" | "completed",
  storage: Awaited<ReturnType<typeof getAnalysisStorage>>,
): Promise<void> {
  if (status === "started") {
    await markAnalyzeJobPhaseStarted(jobId, phase);
  } else {
    await markAnalyzeJobPhaseCompleted(jobId, phase);
  }

  const job = await getAnalyzeJob(jobId);
  if (job && storage) {
    await storage.updateJobProgress(jobId, job.progress).catch(() => undefined);
  }
}
