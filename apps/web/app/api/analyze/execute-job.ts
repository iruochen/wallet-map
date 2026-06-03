import { createDefaultAnalyzers } from "@wallet-map/analyzers";
import type { AnalysisPipelinePhase } from "@wallet-map/core";
import { runAnalysis } from "@wallet-map/core";
import { createLabelGraphEnricher } from "@wallet-map/labels";
import { buildAnalyzeResponse } from "./build-response";
import { resolveAnalyzeEvents } from "./data-source";
import {
  createAnalyzeJob,
  getAnalyzeJob,
  markAnalyzeJobCompleted,
  markAnalyzeJobFailed,
  markAnalyzeJobPhaseCompleted,
  markAnalyzeJobPhaseStarted,
  markAnalyzeJobRunning,
} from "./job-store";
import { createAnalyzeLabelProviders } from "./label-providers";
import type { AnalysisPhaseId } from "./progress";
import type { ParsedAnalyzeRequest } from "./schema";

function mapPipelinePhase(phase: AnalysisPipelinePhase): AnalysisPhaseId {
  return phase;
}

export function startAnalyzeJob(parsed: ParsedAnalyzeRequest): string {
  const jobId = crypto.randomUUID();
  createAnalyzeJob(jobId);
  void executeAnalyzeJob(jobId, parsed);
  return jobId;
}

export async function executeAnalyzeJob(jobId: string, parsed: ParsedAnalyzeRequest): Promise<void> {
  if (!getAnalyzeJob(jobId)) {
    return;
  }

  markAnalyzeJobRunning(jobId);

  try {
    markAnalyzeJobPhaseStarted(jobId, "fetch");
    const resolved = await resolveAnalyzeEvents(parsed);
    markAnalyzeJobPhaseCompleted(jobId, "fetch");

    const result = await runAnalysis({
      watchedAddresses: parsed.addresses,
      events: resolved.events,
      analyzers: createDefaultAnalyzers(),
      graphEnrichers: [
        createLabelGraphEnricher({
          providers: createAnalyzeLabelProviders(),
        }),
      ],
      onProgress: (update) => {
        const phase = mapPipelinePhase(update.phase);

        if (update.status === "started") {
          markAnalyzeJobPhaseStarted(jobId, phase);
          return;
        }

        markAnalyzeJobPhaseCompleted(jobId, phase);
      },
    });

    const response = buildAnalyzeResponse(parsed, resolved, result);
    markAnalyzeJobCompleted(jobId, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";
    markAnalyzeJobFailed(jobId, message);
  }
}
