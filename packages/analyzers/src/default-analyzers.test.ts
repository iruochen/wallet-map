import { describe, expect, it } from "vitest";
import { createDefaultAnalyzers } from "./index";

describe("createDefaultAnalyzers", () => {
  it("registers the default basic and advanced analyzers", () => {
    expect(createDefaultAnalyzers().map((analyzer) => analyzer.id)).toEqual([
      "direct-transfer",
      "shared-counterparty",
      "same-contract-interaction",
      "multi-hop-path",
      "temporal-pattern",
      "bridge-correlation",
    ]);
  });
});
