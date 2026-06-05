import { afterEach, describe, expect, it } from "vitest";
import {
  buildAnonymousQuota,
  formatAnonymousQuotaError,
  readAnonymousAnalysisLimit,
} from "./analysis-quota";

const originalLimit = process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT;

afterEach(() => {
  if (originalLimit === undefined) {
    delete process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT;
  } else {
    process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT = originalLimit;
  }
});

describe("readAnonymousAnalysisLimit", () => {
  it("returns null when limit is disabled", () => {
    process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT = "";
    expect(readAnonymousAnalysisLimit()).toBeNull();

    process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT = "0";
    expect(readAnonymousAnalysisLimit()).toBeNull();

    process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT = "unlimited";
    expect(readAnonymousAnalysisLimit()).toBeNull();
  });

  it("parses positive integer limits", () => {
    process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT = "5";
    expect(readAnonymousAnalysisLimit()).toBe(5);

    process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT = "3.8";
    expect(readAnonymousAnalysisLimit()).toBe(3);
  });
});

describe("buildAnonymousQuota", () => {
  it("returns null when limit is disabled", () => {
    expect(buildAnonymousQuota(2, null)).toBeNull();
  });

  it("computes remaining attempts", () => {
    expect(buildAnonymousQuota(2, 5)).toEqual({
      limit: 5,
      used: 2,
      remaining: 3,
    });
    expect(buildAnonymousQuota(7, 5)).toEqual({
      limit: 5,
      used: 7,
      remaining: 0,
    });
  });
});

describe("formatAnonymousQuotaError", () => {
  it("includes the configured limit", () => {
    expect(formatAnonymousQuotaError(3)).toContain("3");
  });
});
