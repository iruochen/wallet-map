import { describe, expect, it, vi } from "vitest";
import { mapWithConcurrency, resolveAnalyzeEvents, selectAnalyzeLiveProvider } from "./data-source";

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
    expect(result.fallbackReason).toContain("NODEREAL_API_KEY");
    expect(result.fallbackReason).toContain("ETHERSCAN_API_KEY");
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
    expect(result.chainName).toBe("BSC");
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(calledUrl(fetchMock, "txlist").searchParams.get("chainid")).toBe("56");
  });

  it("prefers NodeReal for BSC when a dedicated key is configured", async () => {
    const fetchMock = mockNodeRealFetch();
    const result = await resolveAnalyzeEvents({
      addresses: [...addresses],
      chainId: 56,
      dataMode: "auto",
      env: {
        ETHERSCAN_API_KEY: "etherscan-key",
        NODEREAL_BSC_API_KEY: "nodereal-key",
      },
      fetchImpl: fetchMock,
    });

    expect(result.mode).toBe("live");
    expect(result.source).toBe("nodereal:56:bsc");
    expect(result.chainName).toBe("BSC");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://bsc-mainnet.nodereal.io/v1/nodereal-key");
  });

  it("falls back from NodeReal to Etherscan in auto mode when both providers are configured", async () => {
    const fetchMock = mockNodeRealFailureThenEtherscanFetch();
    const result = await resolveAnalyzeEvents({
      addresses: [addresses[0]],
      chainId: 56,
      dataMode: "auto",
      env: {
        ETHERSCAN_API_KEY: "etherscan-key",
        NODEREAL_BSC_API_KEY: "nodereal-key",
      },
      fetchImpl: fetchMock,
    });

    expect(result.mode).toBe("live");
    expect(result.source).toBe("etherscan-like:56:bsc:fallback-from-nodereal,nodereal:56:bsc");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://bsc-mainnet.nodereal.io/v1/nodereal-key");
    expect(calledUrl(fetchMock, "txlist").searchParams.get("chainid")).toBe("56");
  });

  it("falls back when the primary live provider times out", async () => {
    const fetchMock = mockSlowNodeRealThenEtherscanFetch();
    const result = await resolveAnalyzeEvents({
      addresses: [addresses[0]],
      chainId: 56,
      dataMode: "auto",
      env: {
        ETHERSCAN_API_KEY: "etherscan-key",
        NODEREAL_BSC_API_KEY: "nodereal-key",
        ANALYZE_LIVE_PROVIDER_TIMEOUT_MS: "5",
      },
      fetchImpl: fetchMock,
    });

    expect(result.mode).toBe("live");
    expect(result.source).toBe("etherscan-like:56:bsc:fallback-from-nodereal,nodereal:56:bsc");
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith("https://bsc-mainnet.nodereal.io"))).toBe(true);
    expect(calledUrl(fetchMock, "txlist").searchParams.get("chainid")).toBe("56");
  });

  it("mentions both supported keys when BSC live mode is requested without config", async () => {
    await expect(
      resolveAnalyzeEvents({
        addresses: [...addresses],
        chainId: 56,
        dataMode: "live",
        env: {},
      }),
    ).rejects.toThrow("NODEREAL_API_KEY, NODEREAL_BSC_API_KEY, or ETHERSCAN_API_KEY is required for live BSC analysis.");
  });

  it("returns a clear error when the only live provider times out", async () => {
    const fetchMock = mockSlowEtherscanFetch();

    await expect(
      resolveAnalyzeEvents({
        addresses: [...addresses],
        chainId: 1,
        dataMode: "live",
        env: {
          ETHERSCAN_API_KEY: "etherscan-key",
          ANALYZE_LIVE_PROVIDER_TIMEOUT_MS: "5",
        },
        fetchImpl: fetchMock,
      }),
    ).rejects.toThrow("Ethereum txlist request failed before a response was received: Ethereum provider request timed out after 5ms.");
  });
});

describe("selectAnalyzeLiveProvider", () => {
  it("selects NodeReal first in auto mode and records Etherscan fallback", () => {
    expect(
      selectAnalyzeLiveProvider(56, {
        dataProvider: "auto",
        etherscanApiKey: "etherscan-key",
        nodeRealApiKey: "nodereal-key",
      }),
    ).toEqual({
      chainId: 56,
      provider: "nodereal",
      fallbackProvider: "etherscan-v2",
    });
  });

  it("uses Etherscan first with NodeReal fallback when explicitly selected", () => {
    expect(
      selectAnalyzeLiveProvider(56, {
        dataProvider: "etherscan",
        etherscanApiKey: "etherscan-key",
        nodeRealApiKey: "nodereal-key",
      }),
    ).toEqual({
      chainId: 56,
      provider: "etherscan-v2",
      fallbackProvider: "nodereal",
    });
  });

  it("falls back from Etherscan to NodeReal when explicit Etherscan requests fail", async () => {
    const fetchMock = mockEtherscanFailureThenNodeRealFetch();
    const result = await resolveAnalyzeEvents({
      addresses: [addresses[0]],
      chainId: 56,
      dataMode: "live",
      dataProvider: "etherscan",
      env: {
        ETHERSCAN_API_KEY: "etherscan-key",
        NODEREAL_BSC_API_KEY: "nodereal-key",
      },
      fetchImpl: fetchMock,
    });

    expect(result.mode).toBe("live");
    expect(result.source).toBe("nodereal:56:bsc:fallback-from-etherscan,etherscan-like:56:bsc");
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("action")).toBe("txlist");
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "https://bsc-mainnet.nodereal.io/v1/nodereal-key")).toBe(true);
  });

  it("selects Solscan only for Solana when the Solscan key is configured", () => {
    expect(
      selectAnalyzeLiveProvider(101, {
        dataProvider: "auto",
        etherscanApiKey: "etherscan-key",
        solscanApiKey: "solscan-key",
      }),
    ).toEqual({
      chainId: 101,
      provider: "solscan",
    });
  });

  it("returns no provider when the requested provider is not configured for the chain", () => {
    expect(
      selectAnalyzeLiveProvider(42161, {
        dataProvider: "nodereal",
        nodeRealApiKey: "nodereal-key",
      }),
    ).toEqual({
      chainId: 42161,
      provider: null,
    });
  });
});

describe("mapWithConcurrency", () => {
  it("limits active work and preserves result order", async () => {
    let activeCount = 0;
    let maxActiveCount = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      activeCount += 1;
      maxActiveCount = Math.max(maxActiveCount, activeCount);

      await new Promise((resolve) => setTimeout(resolve, 5));

      activeCount -= 1;
      return value * 10;
    });

    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(maxActiveCount).toBe(2);
  });
});

function mockEtherscanFetch() {
  return vi.fn(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const url = new URL(String(input));
    const action = url.searchParams.get("action");

    if (
      action !== "txlist" &&
      action !== "txlistinternal" &&
      action !== "tokentx" &&
      action !== "tokennfttx"
    ) {
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

function mockNodeRealFetch() {
  let callCount = 0;

  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    callCount += 1;
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      method?: string;
      params?: Array<{ pageKey?: string }>;
    };

    expect(body.method).toBe("nr_getTransactionByAddress");

    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          pageKey: callCount === 1 ? "next-page" : "",
          transfers: [],
        },
      }),
      { status: 200 },
    );
  });
}

function mockNodeRealFailureThenEtherscanFetch() {
  return vi.fn(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const url = String(input);

    if (url.startsWith("https://bsc-mainnet.nodereal.io")) {
      return new Response(JSON.stringify({ error: "provider unavailable" }), {
        status: 500,
        statusText: "Internal Server Error",
      });
    }

    const etherscanUrl = new URL(url);
    const action = etherscanUrl.searchParams.get("action");

    if (
      action !== "txlist" &&
      action !== "txlistinternal" &&
      action !== "tokentx" &&
      action !== "tokennfttx"
    ) {
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

function mockEtherscanFailureThenNodeRealFetch() {
  return vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
    const url = String(input);

    if (url.startsWith("https://api.etherscan.io")) {
      return new Response(JSON.stringify({ status: "0", message: "NOTOK", result: "rate limit" }));
    }

    if (url.startsWith("https://bsc-mainnet.nodereal.io")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      expect(body.method).toBe("nr_getTransactionByAddress");

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            pageKey: "",
            transfers: [],
          },
        }),
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${url}`);
  });
}

function mockSlowNodeRealThenEtherscanFetch() {
  return vi.fn(async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
    const url = String(input);

    if (url.startsWith("https://bsc-mainnet.nodereal.io")) {
      await sleep(50);

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            pageKey: "",
            transfers: [],
          },
        }),
        { status: 200 },
      );
    }

    const etherscanUrl = new URL(url);
    const action = etherscanUrl.searchParams.get("action");

    if (
      action !== "txlist" &&
      action !== "txlistinternal" &&
      action !== "tokentx" &&
      action !== "tokennfttx"
    ) {
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

function mockSlowEtherscanFetch() {
  return vi.fn(async (): Promise<Response> => {
    await sleep(50);

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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
