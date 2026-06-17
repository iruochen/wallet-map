import { describe, expect, it } from "vitest";
import { resolveAnalyzeFetchPlan } from "./fetch-helpers";

describe("resolveAnalyzeFetchPlan", () => {
  it("defaults to a one-year window", () => {
    const plan = resolveAnalyzeFetchPlan({
      env: {
        ANALYZE_DEFAULT_HISTORY_DAYS: "365",
        ANALYZE_MAX_EVENTS_PER_ADDRESS: "10000",
      },
    });

    expect(plan.scope).toBe("window");
    expect(plan.historyDays).toBe(365);
    expect(plan.maxEventsPerAddress).toBe(10_000);
    expect(plan.fromTimestamp).toBeDefined();
    expect(plan.toTimestamp).toBeDefined();
  });

  it("supports full history scope without a from timestamp", () => {
    const plan = resolveAnalyzeFetchPlan({
      historyScope: "full",
      env: {
        ANALYZE_MAX_EVENTS_PER_ADDRESS: "5000",
      },
    });

    expect(plan).toMatchObject({
      scope: "full",
      maxEventsPerAddress: 5000,
    });
    expect(plan.fromTimestamp).toBeUndefined();
  });

  it("clamps custom history days into the supported range", () => {
    const plan = resolveAnalyzeFetchPlan({
      historyDays: 2,
      env: {
        ANALYZE_DEFAULT_HISTORY_DAYS: "365",
      },
    });

    expect(plan.historyDays).toBe(7);
  });
});
