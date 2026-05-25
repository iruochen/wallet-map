import { describe, expect, it, vi } from "vitest";
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
    expect(result.events.length).toBeGreaterThan(1);
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

  it("uses one Etherscan API key for supported live chains", async () => {
    const fetchMock = mockEtherscanFetch();
    const result = await resolveAnalyzeEvents({
      addresses: [...addresses],
      chainId: 56,
      dataMode: "auto",
      env: {
        ETHERSCAN_API_KEY: "test-key",
      },
      fetchImpl: fetchMock,
    });

    expect(result.mode).toBe("live");
    expect(result.source).toBe("etherscan-like:56:bsc");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(calledUrl(fetchMock, "txlist").searchParams.get("chainid")).toBe("56");
  });
});

function mockEtherscanFetch() {
  return vi.fn(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const url = new URL(String(input));
    const action = url.searchParams.get("action");

    if (action !== "txlist" && action !== "tokentx") {
      throw new Error(`Unexpected action ${action}`);
    }

    return new Response(
      JSON.stringify({
        status: "1",
        message: "OK",
        result: [],
      }),
      { status: 200 },
    );
  });
}

function calledUrl(fetchMock: ReturnType<typeof mockEtherscanFetch>, action: string): URL {
  const call = fetchMock.mock.calls.find(([input]) => {
    return new URL(String(input)).searchParams.get("action") === action;
  });

  if (!call) {
    throw new Error(`No fetch call found for ${action}`);
  }

  return new URL(String(call[0]));
}
