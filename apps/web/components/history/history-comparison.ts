import type { HistoryJobItem } from "./history-types";

export interface HistoryComparisonMetric {
  label: string;
  first: string;
  second: string;
  delta?: string;
}

export interface HistoryComparison {
  first: HistoryJobItem;
  second: HistoryJobItem;
  metrics: HistoryComparisonMetric[];
}

export function toggleHistoryComparisonSelection(
  currentIds: string[],
  job: HistoryJobItem,
): string[] {
  if (job.status !== "completed") {
    return currentIds;
  }

  if (currentIds.includes(job.id)) {
    return currentIds.filter((id) => id !== job.id);
  }

  return [...currentIds.slice(-1), job.id];
}

export function buildHistoryComparison(
  jobs: HistoryJobItem[],
  selectedIds: string[],
): HistoryComparison | null {
  if (selectedIds.length !== 2) {
    return null;
  }

  const selectedJobs = selectedIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter((job): job is HistoryJobItem => job !== undefined && job.status === "completed")
    .sort(compareJobsByTime);

  if (selectedJobs.length !== 2) {
    return null;
  }

  const [first, second] = selectedJobs;

  if (!first || !second) {
    return null;
  }

  return {
    first,
    second,
    metrics: [
      buildNumericMetric("Score", first.score?.score, second.score?.score, "/100"),
      buildTextMetric("Confidence", first.score?.confidence, second.score?.confidence),
      buildNumericMetric("Watched", first.watchedAddressCount, second.watchedAddressCount),
      buildNumericMetric("Events", first.eventCount, second.eventCount),
      buildTextMetric("Chain", first.chainName, second.chainName),
      buildTextMetric("Source", first.sourceLabel, second.sourceLabel),
    ],
  };
}

function buildNumericMetric(
  label: string,
  firstValue: number | undefined,
  secondValue: number | undefined,
  suffix = "",
): HistoryComparisonMetric {
  return {
    label,
    first: firstValue === undefined ? "—" : `${firstValue}${suffix}`,
    second: secondValue === undefined ? "—" : `${secondValue}${suffix}`,
    delta:
      firstValue === undefined || secondValue === undefined
        ? undefined
        : formatDelta(secondValue - firstValue, suffix),
  };
}

function buildTextMetric(
  label: string,
  firstValue: string | undefined,
  secondValue: string | undefined,
): HistoryComparisonMetric {
  return {
    label,
    first: firstValue || "—",
    second: secondValue || "—",
    delta: firstValue && secondValue && firstValue !== secondValue ? "changed" : undefined,
  };
}

function formatDelta(delta: number, suffix: string): string {
  if (delta === 0) {
    return `0${suffix}`;
  }

  return `${delta > 0 ? "+" : ""}${delta}${suffix}`;
}

function compareJobsByTime(left: HistoryJobItem, right: HistoryJobItem): number {
  return getJobTime(left) - getJobTime(right);
}

function getJobTime(job: HistoryJobItem): number {
  return new Date(job.completedAt ?? job.createdAt).getTime();
}
