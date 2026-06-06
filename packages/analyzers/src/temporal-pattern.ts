import { getWalletNodeId } from "@wallet-map/core";
import type {
  AnalysisContext,
  Analyzer,
  Finding,
  FindingConfidence,
  GraphEdge,
  GraphNode,
  NormalizedEvent,
} from "@wallet-map/core";
import {
  buildEventEvidence,
  buildNodeIndex,
  clampScore,
  dedupeEvents,
  getAssetKey,
  getEdgesByEvidenceEventId,
  getEventTimestampMs,
  getWatchedWalletNodeIds,
  isDefined,
  isTransferEvent,
  isZeroAddressNodeId,
  sanitizeFindingId,
  uniqueSorted,
} from "./helpers";

const temporalWindowMs = 10 * 60 * 1000;

interface TemporalCandidate {
  groupKey: string;
  patternType: "contract" | "counterparty";
  event: NormalizedEvent;
  edgeIds: string[];
  watchedWalletNodeId: string;
  timestampMs: number;
  contractNodeId?: string;
  counterpartyNodeId?: string;
  amount?: string;
}

interface TemporalWindow {
  candidates: TemporalCandidate[];
  watchedWalletNodeIds: string[];
  score: number;
}

export class TemporalPatternAnalyzer implements Analyzer {
  id = "temporal-pattern";
  name = "Temporal Pattern Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const nodeById = buildNodeIndex(context.graph.nodes);
    const watchedWalletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
    const edgesByEventId = getEdgesByEvidenceEventId(context.graph.edges);
    const candidatesByGroup = new Map<string, TemporalCandidate[]>();

    for (const event of context.events) {
      const timestampMs = getEventTimestampMs(event);
      if (timestampMs === undefined) {
        continue;
      }

      for (const candidate of buildTemporalCandidates({
        event,
        timestampMs,
        nodeById,
        watchedWalletNodeIds,
        edgesByEventId,
      })) {
        const candidates = candidatesByGroup.get(candidate.groupKey) ?? [];
        candidates.push(candidate);
        candidatesByGroup.set(candidate.groupKey, candidates);
      }
    }

    const findings: Finding[] = [];

    for (const [groupKey, candidates] of candidatesByGroup.entries()) {
      const bestWindow = findBestTemporalWindow(candidates, temporalWindowMs);
      if (!bestWindow || bestWindow.watchedWalletNodeIds.length < 2) {
        continue;
      }

      findings.push(this.buildFinding(groupKey, bestWindow));
    }

    return findings.sort((left, right) => left.id.localeCompare(right.id));
  }

  private buildFinding(groupKey: string, window: TemporalWindow): Finding {
    const candidates = window.candidates;
    const first = candidates[0]!;
    const timestamps = candidates.map((candidate) => candidate.timestampMs);
    const windowStart = new Date(Math.min(...timestamps)).toISOString();
    const windowEnd = new Date(Math.max(...timestamps)).toISOString();
    const edgeIds = uniqueSorted(candidates.flatMap((candidate) => candidate.edgeIds));
    const eventIds = uniqueSorted(candidates.map((candidate) => candidate.event.id));
    const evidenceEvents = dedupeEvents(candidates.map((candidate) => candidate.event));
    const scoreImpact = window.score;

    return {
      id: `${this.id}:${sanitizeFindingId(groupKey)}:${windowStart}`,
      analyzerId: this.id,
      title: "Temporal pattern found",
      description: "Watched wallets performed similar activity within a short time window. This is a weak-to-medium relationship signal that should be reviewed with the underlying transactions.",
      severity: scoreImpact >= 15 ? "medium" : "low",
      confidence: assessTemporalConfidence(window),
      scoreImpact,
      evidence: buildEventEvidence(evidenceEvents),
      metadata: {
        watchedWalletNodeIds: window.watchedWalletNodeIds,
        edgeIds,
        eventIds,
        windowStart,
        windowEnd,
        windowMs: Math.max(...timestamps) - Math.min(...timestamps),
        patternType: first.patternType,
        groupKey,
        contractNodeId: first.contractNodeId,
        counterpartyNodeId: first.counterpartyNodeId,
      },
    };
  }
}

function assessTemporalConfidence(window: TemporalWindow): FindingConfidence {
  if (window.watchedWalletNodeIds.length >= 3 || window.score >= 15) {
    return "medium";
  }

  return "low";
}

function buildTemporalCandidates(input: {
  event: NormalizedEvent;
  timestampMs: number;
  nodeById: Map<string, GraphNode>;
  watchedWalletNodeIds: Set<string>;
  edgesByEventId: Map<string, GraphEdge[]>;
}): TemporalCandidate[] {
  const { event, timestampMs, nodeById, watchedWalletNodeIds, edgesByEventId } = input;
  const candidates: TemporalCandidate[] = [];
  const eventEdges = edgesByEventId.get(event.id) ?? [];
  const edgeIds = uniqueSorted(eventEdges.map((edge) => edge.id));

  if (event.type === "contract_call" && event.from && event.contract) {
    const watchedWalletNodeId = getWalletNodeId(event.chainId, event.from);
    if (watchedWalletNodeIds.has(watchedWalletNodeId)) {
      const contractNodeId = `contract:${event.chainId}:${event.contract.toLowerCase()}`;
      candidates.push({
        groupKey: ["contract", event.chainId, event.contract.toLowerCase(), event.methodId ?? "unknown"].join(":"),
        patternType: "contract",
        event,
        edgeIds,
        watchedWalletNodeId,
        timestampMs,
        contractNodeId,
        amount: event.amount,
      });
    }
  }

  if (isTransferEvent(event) && event.from && event.to) {
    const sourceNodeId = getWalletNodeId(event.chainId, event.from);
    const targetNodeId = getWalletNodeId(event.chainId, event.to);
    const sourceIsWatched = watchedWalletNodeIds.has(sourceNodeId);
    const targetIsWatched = watchedWalletNodeIds.has(targetNodeId);
    const sourceNode = nodeById.get(sourceNodeId);
    const targetNode = nodeById.get(targetNodeId);
    const assetKey = getAssetKey(event);

    if (
      sourceIsWatched &&
      targetNode?.kind === "wallet" &&
      targetNode.tags?.includes("observed") &&
      !isZeroAddressNodeId(targetNodeId)
    ) {
      candidates.push({
        groupKey: ["counterparty", event.chainId, targetNodeId, "out", assetKey].join(":"),
        patternType: "counterparty",
        event,
        edgeIds,
        watchedWalletNodeId: sourceNodeId,
        timestampMs,
        counterpartyNodeId: targetNodeId,
        amount: event.amount,
      });
    }

    if (
      targetIsWatched &&
      sourceNode?.kind === "wallet" &&
      sourceNode.tags?.includes("observed") &&
      !isZeroAddressNodeId(sourceNodeId)
    ) {
      candidates.push({
        groupKey: ["counterparty", event.chainId, sourceNodeId, "in", assetKey].join(":"),
        patternType: "counterparty",
        event,
        edgeIds,
        watchedWalletNodeId: targetNodeId,
        timestampMs,
        counterpartyNodeId: sourceNodeId,
        amount: event.amount,
      });
    }
  }

  return candidates;
}

function findBestTemporalWindow(candidates: TemporalCandidate[], windowMs: number): TemporalWindow | undefined {
  const sorted = [...candidates].sort((left, right) => left.timestampMs - right.timestampMs || left.event.id.localeCompare(right.event.id));
  let best: TemporalWindow | undefined;

  for (let start = 0; start < sorted.length; start += 1) {
    const windowCandidates: TemporalCandidate[] = [];
    for (let index = start; index < sorted.length; index += 1) {
      if (sorted[index]!.timestampMs - sorted[start]!.timestampMs > windowMs) {
        break;
      }
      windowCandidates.push(sorted[index]!);
    }

    const watchedWalletNodeIds = uniqueSorted(windowCandidates.map((candidate) => candidate.watchedWalletNodeId));
    if (watchedWalletNodeIds.length < 2) {
      continue;
    }

    const score = assessTemporalScore(windowCandidates, watchedWalletNodeIds.length);
    const candidateWindow: TemporalWindow = {
      candidates: windowCandidates,
      watchedWalletNodeIds,
      score,
    };

    if (!best || compareTemporalWindows(candidateWindow, best) < 0) {
      best = candidateWindow;
    }
  }

  return best;
}

function assessTemporalScore(candidates: TemporalCandidate[], watchedWalletCount: number): number {
  const amounts = candidates.map((candidate) => candidate.amount).filter(isDefined);
  const sameAmount = amounts.length >= 2 && new Set(amounts).size === 1;
  const bonus = (watchedWalletCount >= 3 ? 5 : 0) + (sameAmount ? 5 : 0);

  return clampScore(10 + bonus, 5, 20);
}

function compareTemporalWindows(left: TemporalWindow, right: TemporalWindow): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  if (left.watchedWalletNodeIds.length !== right.watchedWalletNodeIds.length) {
    return right.watchedWalletNodeIds.length - left.watchedWalletNodeIds.length;
  }

  return getWindowSpan(left.candidates) - getWindowSpan(right.candidates);
}

function getWindowSpan(candidates: Array<{ timestampMs: number }>): number {
  const timestamps = candidates.map((candidate) => candidate.timestampMs);
  return Math.max(...timestamps) - Math.min(...timestamps);
}
