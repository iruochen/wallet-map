import { describe, expect, it } from "vitest";
import type { AnalysisJobProgress } from "./progress";
import {
  applyPhaseCompleted,
  applyPhaseStarted,
  getProgressPercent,
  resolveStepState,
} from "./progress";

describe("analysis progress helpers", () => {
  it("marks phases done and advances active phase", () => {
    let progress = applyPhaseStarted({ phase: null, completedPhases: [] }, "fetch");
    expect(progress.phase).toBe("fetch");

    progress = applyPhaseCompleted(progress, "fetch");
    expect(progress.completedPhases).toContain("fetch");
    expect(progress.phase).toBe("graph");
  });

  it("resolves step states from server progress", () => {
    const progress: AnalysisJobProgress = {
      phase: "labels",
      completedPhases: ["fetch", "graph"],
    };

    expect(resolveStepState("fetch", progress)).toBe("done");
    expect(resolveStepState("graph", progress)).toBe("done");
    expect(resolveStepState("labels", progress)).toBe("active");
    expect(resolveStepState("analysis", progress)).toBe("idle");
  });

  it("calculates percent from completed and active phases", () => {
    expect(
      getProgressPercent({
        phase: "graph",
        completedPhases: ["fetch"],
      }),
    ).toBeGreaterThan(20);

    expect(
      getProgressPercent({
        phase: null,
        completedPhases: ["fetch", "graph", "labels", "analysis"],
      }),
    ).toBe(100);
  });
});
