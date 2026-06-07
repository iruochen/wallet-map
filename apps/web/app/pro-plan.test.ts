import { describe, expect, it } from "vitest";
import {
  buildProductPlanSnapshot,
  formatPlanCapabilitySummary,
  getNextProductPlan,
  productPlanCatalog,
} from "./pro-plan";

describe("buildProductPlanSnapshot", () => {
  it("builds an anonymous trial snapshot with quota context", () => {
    const plan = buildProductPlanSnapshot({
      authenticated: false,
      anonymousAnalysisQuota: { limit: 5, used: 2, remaining: 3 },
    });

    expect(plan.tier).toBe("anonymous");
    expect(plan.summary).toContain("3 of 5");
    expect(plan.capabilities.some((capability) => capability.id === "history-retention")).toBe(true);
  });

  it("builds a signed-in free snapshot without mutating the catalog", () => {
    const plan = buildProductPlanSnapshot({ authenticated: true });
    plan.capabilities[0].value = "mutated";

    expect(plan.tier).toBe("free");
    expect(productPlanCatalog.free.capabilities[0].value).not.toBe("mutated");
  });
});

describe("getNextProductPlan", () => {
  it("returns the next upgrade tier", () => {
    expect(getNextProductPlan("anonymous")?.tier).toBe("free");
    expect(getNextProductPlan("free")?.tier).toBe("pro");
    expect(getNextProductPlan("team")).toBeNull();
  });
});

describe("formatPlanCapabilitySummary", () => {
  it("summarizes included capabilities", () => {
    expect(formatPlanCapabilitySummary(productPlanCatalog.pro)).toContain("Address capacity");
    expect(formatPlanCapabilitySummary(productPlanCatalog.pro)).toContain("Team labels");
  });
});
