import { describe, expect, it } from "vitest";
import {
  formatSkippedChainDetails,
  formatSkippedChainSummary,
  partitionAnalysisWarnings,
  type TranslateFn,
} from "./formatters";

const dictionary = {
  "analysis.skippedChain.summaryGeneric": "{count} skipped",
  "analysis.skippedChain.summaryNamed": "Skipped chains: {chains}",
  "analysis.summary.reasonSeparator": ", ",
  "analysis.skippedChain.reason.unsupportedPlan": "unsupported",
  "analysis.skippedChain.reason.network": "network",
  "analysis.skippedChain.reason.missingConfig": "missing config",
  "analysis.skippedChain.reason.rateLimit": "rate limit",
  "analysis.skippedChain.reason.generic": "generic",
} as const;

const t: TranslateFn = (key, params) => {
  const template = String(dictionary[key as keyof typeof dictionary] ?? key);
  return Object.entries(params ?? {}).reduce<string>(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    template,
  );
};

describe("partitionAnalysisWarnings", () => {
  it("separates skipped-chain warnings from coverage notices", () => {
    const warnings = [
      "BSC skipped: fetch failed",
      "Live analysis uses the last 365 days of on-chain history.",
    ];

    expect(partitionAnalysisWarnings(warnings)).toEqual({
      skippedChains: ["BSC skipped: fetch failed"],
      coverage: ["Live analysis uses the last 365 days of on-chain history."],
      other: [],
    });
  });
});

describe("skipped chain formatting", () => {
  it("does not treat coverage notices as skipped chains", () => {
    const warnings = [
      "BSC skipped: fetch failed",
      "Live analysis uses the last 365 days of on-chain history.",
    ];

    expect(formatSkippedChainSummary(t, warnings)).toBe("Skipped chains: BSC");
    expect(formatSkippedChainDetails(t, warnings)).toEqual(["BSC: network"]);
  });
});
