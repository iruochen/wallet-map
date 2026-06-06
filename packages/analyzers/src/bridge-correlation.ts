import type {
  AnalysisContext,
  Analyzer,
  Finding,
  FindingConfidence,
  NormalizedEvent,
} from "@wallet-map/core";
import {
  buildEventEvidence,
  clampScore,
  dedupeEvents,
  getAssetKey,
  getEdgesByEvidenceEventId,
  getEventTimestampMs,
  getWatchedActorNodeId,
  getWatchedWalletNodeIds,
  hasSimilarAmounts,
  isDefined,
  readMetadataNumber,
  readMetadataString,
  sanitizeFindingId,
  uniqueSorted,
} from "./helpers";

const bridgeWindowMs = 30 * 60 * 1000;

interface BridgeCandidate {
  event: NormalizedEvent;
  watchedWalletNodeId: string;
  timestampMs: number;
  groupKey: string;
  route: BridgeRoute;
  assetKey: string;
  amount?: string;
  edgeIds: string[];
}

interface BridgeRoute {
  sourceChainId: number;
  destinationChainId?: number;
  protocol?: string;
  contract?: string;
}

interface BridgeWindow {
  candidates: BridgeCandidate[];
  watchedWalletNodeIds: string[];
  score: number;
  similarAmounts: boolean;
}

export class BridgeCorrelationAnalyzer implements Analyzer {
  id = "bridge-correlation";
  name = "Bridge Correlation Analyzer";

  async run(context: AnalysisContext): Promise<Finding[]> {
    const watchedWalletNodeIds = getWatchedWalletNodeIds(context.graph.nodes);
    const edgesByEventId = getEdgesByEvidenceEventId(context.graph.edges);
    const candidatesByGroup = new Map<string, BridgeCandidate[]>();

    for (const event of context.events) {
      if (event.type !== "bridge") {
        continue;
      }

      const timestampMs = getEventTimestampMs(event);
      const watchedWalletNodeId = getWatchedActorNodeId(event, watchedWalletNodeIds);
      if (timestampMs === undefined || !watchedWalletNodeId) {
        continue;
      }

      const route = buildBridgeRoute(event);
      const assetKey = getAssetKey(event);
      const groupKey = buildBridgeGroupKey(route, assetKey);
      const candidate: BridgeCandidate = {
        event,
        watchedWalletNodeId,
        timestampMs,
        groupKey,
        route,
        assetKey,
        amount: event.amount,
        edgeIds: uniqueSorted((edgesByEventId.get(event.id) ?? []).map((edge) => edge.id)),
      };
      const candidates = candidatesByGroup.get(groupKey) ?? [];
      candidates.push(candidate);
      candidatesByGroup.set(groupKey, candidates);
    }

    const findings: Finding[] = [];

    for (const [groupKey, candidates] of candidatesByGroup.entries()) {
      const bestWindow = findBestBridgeWindow(candidates, bridgeWindowMs);
      if (!bestWindow || bestWindow.watchedWalletNodeIds.length < 2) {
        continue;
      }

      findings.push(this.buildFinding(groupKey, bestWindow));
    }

    return findings.sort((left, right) => left.id.localeCompare(right.id));
  }

  private buildFinding(groupKey: string, window: BridgeWindow): Finding {
    const candidates = window.candidates;
    const first = candidates[0]!;
    const timestamps = candidates.map((candidate) => candidate.timestampMs);
    const windowStart = new Date(Math.min(...timestamps)).toISOString();
    const windowEnd = new Date(Math.max(...timestamps)).toISOString();
    const eventIds = uniqueSorted(candidates.map((candidate) => candidate.event.id));
    const edgeIds = uniqueSorted(candidates.flatMap((candidate) => candidate.edgeIds));
    const amounts = uniqueSorted(candidates.map((candidate) => candidate.amount).filter(isDefined));
    const evidenceEvents = dedupeEvents(candidates.map((candidate) => candidate.event));

    return {
      id: `${this.id}:${sanitizeFindingId(groupKey)}:${windowStart}`,
      analyzerId: this.id,
      title: "Bridge correlation found",
      description: "Watched wallets used a similar bridge route within a related time window. Review the bridge transactions before drawing ownership conclusions.",
      severity: "medium",
      confidence: assessBridgeConfidence(window),
      scoreImpact: window.score,
      evidence: buildEventEvidence(evidenceEvents),
      metadata: {
        watchedWalletNodeIds: window.watchedWalletNodeIds,
        eventIds,
        edgeIds,
        windowStart,
        windowEnd,
        windowMs: Math.max(...timestamps) - Math.min(...timestamps),
        route: first.route,
        assetKey: first.assetKey,
        amounts,
        similarAmounts: window.similarAmounts,
      },
    };
  }
}

function assessBridgeConfidence(window: BridgeWindow): FindingConfidence {
  const route = window.candidates[0]?.route;

  if (window.similarAmounts && window.watchedWalletNodeIds.length >= 3 && route?.destinationChainId !== undefined) {
    return "high";
  }

  if (route?.destinationChainId !== undefined && route.protocol && window.score >= 22) {
    return "medium";
  }

  return route?.destinationChainId === undefined ? "low" : "medium";
}

function findBestBridgeWindow(candidates: BridgeCandidate[], windowMs: number): BridgeWindow | undefined {
  const sorted = [...candidates].sort((left, right) => left.timestampMs - right.timestampMs || left.event.id.localeCompare(right.event.id));
  let best: BridgeWindow | undefined;

  for (let start = 0; start < sorted.length; start += 1) {
    const windowCandidates: BridgeCandidate[] = [];
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

    const similarAmounts = hasSimilarAmounts(windowCandidates.map((candidate) => candidate.amount).filter(isDefined));
    const score = assessBridgeScore(windowCandidates, watchedWalletNodeIds.length, similarAmounts);
    const candidateWindow: BridgeWindow = {
      candidates: windowCandidates,
      watchedWalletNodeIds,
      score,
      similarAmounts,
    };

    if (!best || compareBridgeWindows(candidateWindow, best) < 0) {
      best = candidateWindow;
    }
  }

  return best;
}

function assessBridgeScore(
  candidates: BridgeCandidate[],
  watchedWalletCount: number,
  similarAmounts: boolean,
): number {
  const route = candidates[0]?.route;
  const score = 18
    + (route?.destinationChainId !== undefined ? 4 : 0)
    + (route?.protocol ? 4 : 0)
    + (similarAmounts ? 6 : 0)
    + (watchedWalletCount >= 3 ? 5 : 0);

  return route?.destinationChainId === undefined
    ? clampScore(score, 12, 22)
    : clampScore(score, 12, 32);
}

function compareBridgeWindows(left: BridgeWindow, right: BridgeWindow): number {
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

function buildBridgeRoute(event: NormalizedEvent): BridgeRoute {
  const destinationChainId = readMetadataNumber(event.metadata, ["destinationChainId", "dstChainId", "toChainId"]);
  const metadataProtocol = readMetadataString(event.metadata, ["bridge", "protocol"]);

  return {
    sourceChainId: event.chainId,
    destinationChainId,
    protocol: metadataProtocol ?? event.contract?.toLowerCase(),
    contract: event.contract?.toLowerCase(),
  };
}

function buildBridgeGroupKey(route: BridgeRoute, assetKey: string): string {
  return [
    "bridge",
    route.sourceChainId,
    route.destinationChainId ?? "unknown",
    route.protocol ?? route.contract ?? "unknown",
    assetKey,
  ].join(":");
}
