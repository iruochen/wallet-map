import { describe, expect, it } from "vitest";
import {
  formatAbsoluteTime,
  formatAmount,
  formatEdgeKindLabel,
  formatEventTypeLabel,
  formatRelativeTime,
  shortenAddress,
  shortenTxHash,
} from "./format";

describe("format helpers", () => {
  it("shortens addresses and tx hashes", () => {
    expect(shortenAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe("0xaaaa…aaaa");
    expect(shortenAddress("0xshort")).toBe("0xshort");
    expect(
      shortenTxHash("0x1111111111111111111111111111111111111111111111111111111111111111"),
    ).toBe("0x11111111…111111");
  });

  it("formats native and erc20 amounts using token decimals", () => {
    expect(formatAmount("1000000000000000000", 18)).toBe("1");
    expect(formatAmount("123456789012345678", 18)).toBe("0.123456");
    expect(formatAmount("2500000", 6)).toBe("2.5");
    expect(formatAmount("0", 18)).toBe("0");
    expect(formatAmount(undefined, 18)).toBeUndefined();
  });

  it("returns the raw amount when decimals do not apply", () => {
    expect(formatAmount("1234", 0)).toBe("1234");
    expect(formatAmount("not-a-number", 18)).toBe("not-a-number");
  });

  it("formats relative time differences", () => {
    const now = new Date("2024-01-02T00:00:00.000Z");
    expect(formatRelativeTime("2024-01-01T23:59:30.000Z", now)).toBe("30s ago");
    expect(formatRelativeTime("2024-01-01T23:00:00.000Z", now)).toBe("1h ago");
    expect(formatRelativeTime("2023-12-30T00:00:00.000Z", now)).toBe("3d ago");
  });

  it("formats absolute timestamps in zh-CN", () => {
    const formatted = formatAbsoluteTime("2024-01-01T00:00:00.000Z");
    expect(formatted).toBeDefined();
    expect(formatted).toMatch(/2024/);
  });

  it("maps event and edge kinds to human labels", () => {
    expect(formatEventTypeLabel("token_transfer")).toBe("Token Transfer");
    expect(formatEdgeKindLabel("contract_interaction")).toBe("Contract Interaction");
    expect(formatEventTypeLabel("unknown_kind")).toBe("Unknown Kind");
  });
});
