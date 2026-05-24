import { describe, expect, it } from "vitest";
import { resolveAnalyzeEvents } from "./data-source";

const addresses = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
] as const;

describe("resolveAnalyzeEvents", () => {
  it("uses fixture events in auto mode when no API key exists", async () => {
    const result = await resolveAnalyzeEvents({
      addresses: [...addresses],
      chainId: 1,
      dataMode: "auto",
      env: {},
    });

    expect(result.mode).toBe("fixture");
    expect(result.source).toBe("fixtures/sample-events.json");
    expect(result.events).toHaveLength(1);
  });

  it("requires the scan API key in explicit live mode", async () => {
    await expect(
      resolveAnalyzeEvents({
        addresses: [...addresses],
        chainId: 1,
        dataMode: "live",
        env: {},
      }),
    ).rejects.toThrow("ETHERSCAN_API_KEY is required for live Ethereum analysis.");
  });
});
