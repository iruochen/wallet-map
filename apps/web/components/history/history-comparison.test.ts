import { describe, expect, it } from "vitest";
import {
  buildHistoryComparison,
  toggleHistoryComparisonSelection,
} from "./history-comparison";
import type { HistoryJobItem } from "./history-types";

const firstJob: HistoryJobItem = {
  id: "job-1",
  status: "completed",
  chainName: "Ethereum",
  sourceLabel: "Fixture data",
  dataMode: "fixture",
  watchedAddressCount: 2,
  eventCount: 10,
  score: { score: 30, confidence: "medium" },
  createdAt: "2024-01-01T00:00:00.000Z",
  completedAt: "2024-01-01T00:01:00.000Z",
};

const secondJob: HistoryJobItem = {
  ...firstJob,
  id: "job-2",
  sourceLabel: "Etherscan live",
  eventCount: 18,
  score: { score: 48, confidence: "high" },
  createdAt: "2024-01-02T00:00:00.000Z",
  completedAt: "2024-01-02T00:01:00.000Z",
};

describe("history comparison helpers", () => {
  it("selects only completed jobs and caps selection to two ids", () => {
    expect(toggleHistoryComparisonSelection([], firstJob)).toEqual(["job-1"]);
    expect(toggleHistoryComparisonSelection(["job-1"], { ...secondJob, status: "running" })).toEqual(["job-1"]);
    expect(toggleHistoryComparisonSelection(["job-1", "job-2"], { ...firstJob, id: "job-3" })).toEqual([
      "job-2",
      "job-3",
    ]);
    expect(toggleHistoryComparisonSelection(["job-2", "job-3"], { ...firstJob, id: "job-2" })).toEqual(["job-3"]);
  });

  it("builds ordered comparison metrics", () => {
    const comparison = buildHistoryComparison([secondJob, firstJob], ["job-2", "job-1"]);

    expect(comparison?.first.id).toBe("job-1");
    expect(comparison?.second.id).toBe("job-2");
    expect(comparison?.metrics).toContainEqual({
      label: "Score",
      first: "30/100",
      second: "48/100",
      delta: "+18/100",
    });
    expect(comparison?.metrics).toContainEqual({
      label: "Events",
      first: "10",
      second: "18",
      delta: "+8",
    });
    expect(comparison?.metrics).toContainEqual({
      label: "Source",
      first: "Fixture data",
      second: "Etherscan live",
      delta: "changed",
    });
  });

  it("returns null unless exactly two completed jobs are selected", () => {
    expect(buildHistoryComparison([firstJob], ["job-1"])).toBeNull();
    expect(buildHistoryComparison([{ ...firstJob, status: "failed" }, secondJob], ["job-1", "job-2"])).toBeNull();
  });
});
