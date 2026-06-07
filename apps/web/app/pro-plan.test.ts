import { describe, expect, it } from "vitest";
import {
  buildProductPlanSnapshot,
  formatAddressCapacityError,
  formatPlanCapabilitySummary,
  getNextProductPlan,
  getProductPlanLimits,
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

describe("product plan limits", () => {
  it("keeps address capacity aligned with the tier ladder", () => {
    expect(getProductPlanLimits("anonymous").maxAddresses).toBeLessThan(getProductPlanLimits("free").maxAddresses);
    expect(getProductPlanLimits("free").maxAddresses).toBeLessThan(getProductPlanLimits("pro").maxAddresses);
    expect(getProductPlanLimits("pro").maxAddresses).toBeLessThan(getProductPlanLimits("team").maxAddresses);
  });

  it("formats address capacity errors with tier context", () => {
    expect(formatAddressCapacityError("anonymous", 12)).toContain("Anonymous");
    expect(formatAddressCapacityError("anonymous", 12)).toContain("10");
    expect(formatAddressCapacityError("anonymous", 12)).toContain("12");
  });
});
