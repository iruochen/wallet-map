import type { FetchCoverage, FetchPlan, HistoryScope, NormalizedEvent } from "@wallet-map/core";

export const defaultMaxEventsPerAddress = 10_000;
export const defaultPageOffset = 1000;
export const defaultHistoryDays = 365;
export const minHistoryDays = 7;
export const maxHistoryDays = 1095;

export interface AdapterFetchResult {
  events: NormalizedEvent[];
  coverage: FetchCoverage;
}

export function resolveAdapterFetchPlan(plan?: FetchPlan): Required<Pick<FetchPlan, "scope" | "maxEventsPerAddress">> &
  Pick<FetchPlan, "fromTimestamp" | "toTimestamp"> {
  const now = Math.floor(Date.now() / 1000);

  return {
    scope: plan?.scope ?? "full",
    fromTimestamp: plan?.fromTimestamp,
    toTimestamp: plan?.toTimestamp ?? now,
    maxEventsPerAddress: plan?.maxEventsPerAddress ?? defaultMaxEventsPerAddress,
  };
}

export function mergeFetchCoverage(left: FetchCoverage, right: FetchCoverage): FetchCoverage {
  return {
    fetched: left.fetched + right.fetched,
    truncated: left.truncated || right.truncated,
    reason: left.reason ?? right.reason,
  };
}

export function finalizeFetchCoverage(
  events: NormalizedEvent[],
  input: { truncated: boolean; reason?: string },
): FetchCoverage {
  return {
    fetched: events.length,
    truncated: input.truncated,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

export function eventTimestampSeconds(event: NormalizedEvent): number {
  return Math.floor(new Date(event.timestamp).getTime() / 1000);
}

export function filterEventsByWindow(
  events: NormalizedEvent[],
  fromTimestamp?: number,
  toTimestamp?: number,
): NormalizedEvent[] {
  return events.filter((event) => {
    const timestamp = eventTimestampSeconds(event);

    if (fromTimestamp !== undefined && timestamp < fromTimestamp) {
      return false;
    }

    if (toTimestamp !== undefined && timestamp > toTimestamp) {
      return false;
    }

    return true;
  });
}

export function capEvents(events: NormalizedEvent[], maxEvents: number): {
  events: NormalizedEvent[];
  truncated: boolean;
} {
  if (events.length <= maxEvents) {
    return { events, truncated: false };
  }

  return {
    events: events.slice(0, maxEvents),
    truncated: true,
  };
}

export function buildMaxEventsReason(maxEvents: number): string {
  return `Reached the ${maxEvents} event safety cap for this address.`;
}

export function buildWindowDaysReason(days: number): string {
  return `Only events from the last ${days} days were fetched.`;
}

export interface ResolveAnalyzeFetchPlanInput {
  historyScope?: HistoryScope;
  historyDays?: number;
  env?: Record<string, string | undefined>;
}

export function resolveAnalyzeFetchPlan(input: ResolveAnalyzeFetchPlanInput = {}): FetchPlan & {
  historyDays: number;
} {
  const env = input.env ?? {};
  const scope = input.historyScope ?? "window";
  const configuredDays = Number(env.ANALYZE_DEFAULT_HISTORY_DAYS ?? defaultHistoryDays);
  const defaultDays = Number.isFinite(configuredDays) ? configuredDays : defaultHistoryDays;
  const historyDays = clampHistoryDays(input.historyDays ?? defaultDays);
  const configuredMax = Number(env.ANALYZE_MAX_EVENTS_PER_ADDRESS ?? defaultMaxEventsPerAddress);
  const maxEventsPerAddress = Number.isFinite(configuredMax)
    ? Math.max(1, Math.floor(configuredMax))
    : defaultMaxEventsPerAddress;
  const now = Math.floor(Date.now() / 1000);

  if (scope === "full") {
    return {
      scope,
      maxEventsPerAddress,
      historyDays,
    };
  }

  return {
    scope,
    fromTimestamp: now - historyDays * 86_400,
    toTimestamp: now,
    maxEventsPerAddress,
    historyDays,
  };
}

function clampHistoryDays(days: number): number {
  if (!Number.isFinite(days)) {
    return defaultHistoryDays;
  }

  return Math.min(maxHistoryDays, Math.max(minHistoryDays, Math.floor(days)));
}
