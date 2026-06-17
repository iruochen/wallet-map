import { describe, expect, it } from "vitest";
import {
  defaultHistoryScopeSelection,
  parseHistoryScopeSelection,
  resolveHistoryScopeSelection,
} from "./history-scope-options";

describe("history scope selection", () => {
  it("defaults to one year window", () => {
    expect(defaultHistoryScopeSelection).toBe("window:365");
    expect(parseHistoryScopeSelection(defaultHistoryScopeSelection)).toEqual({
      historyScope: "window",
      historyDays: 365,
    });
  });

  it("parses full history selection", () => {
    expect(parseHistoryScopeSelection("full")).toEqual({ historyScope: "full" });
  });

  it("resolves saved window days back to the closest known option", () => {
    expect(resolveHistoryScopeSelection("window", 180)).toBe("window:180");
    expect(resolveHistoryScopeSelection("window", 90)).toBe("window:90");
    expect(resolveHistoryScopeSelection("full")).toBe("full");
    expect(resolveHistoryScopeSelection("window", 120)).toBe(defaultHistoryScopeSelection);
  });
});
