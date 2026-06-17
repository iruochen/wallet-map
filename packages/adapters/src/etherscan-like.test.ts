import { afterEach, describe, expect, it, vi } from "vitest";
import { EtherscanLikeAdapter } from "./etherscan-like";

const watchedAddress = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const counterpartyAddress = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const tokenAddress = "0xcccccccccccccccccccccccccccccccccccccccc";

describe("EtherscanLikeAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes native transfers from txlist responses", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [
        {
          blockNumber: "100",
          timeStamp: "1704067200",
          hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          from: watchedAddress,
          to: counterpartyAddress,
          value: "123000000000000000",
          input: "0x",
          isError: "0",
          txreceipt_status: "1",
        },
      ],
      txlistinternal: [],
      tokentx: [],
      tokennfttx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      chainId: 1,
      name: "Ethereum",
    });

    const { events } = await adapter.getEvents({ address: watchedAddress });

    expect(events).toEqual([
      expect.objectContaining({
        id: "etherscan:1:txlist:0x1111111111111111111111111111111111111111111111111111111111111111",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 100,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: watchedAddress,
        to: counterpartyAddress,
        amount: "123000000000000000",
        asset: {
          kind: "native",
          chainId: 1,
        },
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(calledUrl(fetchMock, "txlist").searchParams.has("apikey")).toBe(false);
  });

  it("adds contract call events for successful transactions with calldata", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [
        {
          blockNumber: "104",
          timeStamp: "1704067440",
          hash: "0x5555555555555555555555555555555555555555555555555555555555555555",
          from: watchedAddress,
          to: tokenAddress,
          value: "0",
          input: "0xa9059cbb000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          isError: "0",
          txreceipt_status: "1",
        },
      ],
      txlistinternal: [],
      tokentx: [],
      tokennfttx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/v2/api",
      apiKey: "test-key",
      chainId: 1,
      name: "Ethereum",
      useChainIdParam: true,
    });

    const { events } = await adapter.getEvents({ address: watchedAddress });

    expect(events).toEqual([
      expect.objectContaining({
        id: "etherscan:1:contract:0x5555555555555555555555555555555555555555555555555555555555555555",
        type: "contract_call",
        from: watchedAddress,
        contract: tokenAddress,
        methodId: "0xa9059cbb",
        metadata: expect.objectContaining({
          input: "0xa9059cbb000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          value: "0",
        }),
      }),
    ]);
  });

  it("normalizes token transfers from tokentx responses", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
      txlistinternal: [],
      tokentx: [
        {
          blockNumber: "101",
          timeStamp: "1704067260",
          hash: "0x2222222222222222222222222222222222222222222222222222222222222222",
          from: counterpartyAddress,
          to: watchedAddress,
          value: "2500000",
          contractAddress: tokenAddress,
          tokenSymbol: "USDC",
          tokenDecimal: "6",
          logIndex: "7",
        },
      ],
      tokennfttx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.basescan.org/api",
      apiKey: "test-key",
      chainId: 8453,
      name: "Base",
    });

    const { events } = await adapter.getEvents({
      address: watchedAddress,
      range: {
        fromBlock: 10,
        toBlock: 200,
      },
    });

    expect(events).toEqual([
      expect.objectContaining({
        id: "etherscan:8453:tokentx:0x2222222222222222222222222222222222222222222222222222222222222222:7",
        type: "token_transfer",
        chainId: 8453,
        blockNumber: 101,
        timestamp: "2024-01-01T00:01:00.000Z",
        from: counterpartyAddress,
        to: watchedAddress,
        contract: tokenAddress,
        amount: "2500000",
        asset: {
          kind: "erc20",
          chainId: 8453,
          symbol: "USDC",
          contract: tokenAddress,
          tokenId: undefined,
        },
      }),
    ]);

    const txlistUrl = calledUrl(fetchMock, "txlist");
    expect(txlistUrl.searchParams.get("apikey")).toBe("test-key");
    expect(txlistUrl.searchParams.get("startblock")).toBe("10");
    expect(txlistUrl.searchParams.get("endblock")).toBe("200");
  });

  it("normalizes internal transfers from txlistinternal responses", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
      txlistinternal: [
        {
          blockNumber: "102",
          timeStamp: "1704067320",
          hash: "0x3333333333333333333333333333333333333333333333333333333333333333",
          from: watchedAddress,
          to: counterpartyAddress,
          value: "4200000000000000",
          isError: "0",
          errCode: "",
          traceId: "call_0_1",
        },
      ],
      tokentx: [],
      tokennfttx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/v2/api",
      apiKey: "test-key",
      chainId: 1,
      name: "Ethereum",
      useChainIdParam: true,
    });

    const { events } = await adapter.getEvents({ address: watchedAddress });

    expect(events).toEqual([
      expect.objectContaining({
        id: "etherscan:1:txlistinternal:0x3333333333333333333333333333333333333333333333333333333333333333:call_0_1",
        type: "native_transfer",
        amount: "4200000000000000",
        from: watchedAddress,
        to: counterpartyAddress,
        metadata: expect.objectContaining({
          transferScope: "internal",
          traceId: "call_0_1",
        }),
      }),
    ]);
  });

  it("normalizes ERC721 transfers from tokennfttx responses", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
      txlistinternal: [],
      tokentx: [],
      tokennfttx: [
        {
          blockNumber: "103",
          timeStamp: "1704067380",
          hash: "0x4444444444444444444444444444444444444444444444444444444444444444",
          from: counterpartyAddress,
          to: watchedAddress,
          contractAddress: tokenAddress,
          tokenSymbol: "NFT",
          tokenID: "1234",
          logIndex: "3",
        },
      ],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/v2/api",
      apiKey: "test-key",
      chainId: 8453,
      name: "Base",
      useChainIdParam: true,
    });

    const { events } = await adapter.getEvents({ address: watchedAddress });

    expect(events).toEqual([
      expect.objectContaining({
        id: "etherscan:8453:tokennfttx:0x4444444444444444444444444444444444444444444444444444444444444444:3",
        type: "nft_transfer",
        from: counterpartyAddress,
        to: watchedAddress,
        contract: tokenAddress,
        asset: {
          kind: "erc721",
          chainId: 8453,
          symbol: "NFT",
          contract: tokenAddress,
          tokenId: "1234",
        },
      }),
    ]);
  });

  it("supports Etherscan API V2 chainid requests", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
      txlistinternal: [],
      tokentx: [],
      tokennfttx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/v2/api",
      apiKey: "test-key",
      chainId: 56,
      name: "BSC",
      useChainIdParam: true,
    });

    await adapter.getEvents({ address: watchedAddress });

    const txlistUrl = calledUrl(fetchMock, "txlist");
    expect(txlistUrl.origin + txlistUrl.pathname).toBe("https://api.etherscan.io/v2/api");
    expect(txlistUrl.searchParams.get("chainid")).toBe("56");
    expect(txlistUrl.searchParams.get("apikey")).toBe("test-key");
  });

  it("omits chainid for legacy Etherscan-like endpoints", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
      txlistinternal: [],
      tokentx: [],
      tokennfttx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.bscscan.com/api",
      chainId: 56,
      name: "BSC Legacy",
    });

    await adapter.getEvents({ address: watchedAddress });

    expect(calledUrl(fetchMock, "txlist").searchParams.has("chainid")).toBe(false);
  });

  it("throws a clear error for Etherscan status=0 responses", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get("action");

      return new Response(
        JSON.stringify({
          status: action === "txlist" ? "0" : "1",
          message: action === "txlist" ? "NOTOK" : "OK",
          result: action === "txlist" ? "Invalid API Key" : [],
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      apiKey: "",
      chainId: 1,
      name: "Ethereum",
    });

    await expect(adapter.getEvents({ address: watchedAddress })).rejects.toThrow(
      "Ethereum txlist request failed: NOTOK (Invalid API Key)",
    );
  });

  it("treats empty status=0 array responses as no events", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          status: "0",
          message: "No transactions found",
          result: [],
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      chainId: 1,
      name: "Ethereum",
    });

    await expect(adapter.getEvents({ address: watchedAddress })).resolves.toMatchObject({
      events: [],
      coverage: { fetched: 0, truncated: false },
    });
  });

  it("throws a clear error for non-OK HTTP responses", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ status: "0", message: "NOTOK", result: [] }), {
        status: 503,
        statusText: "Service Unavailable",
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      chainId: 1,
      name: "Ethereum",
    });

    await expect(adapter.getEvents({ address: watchedAddress })).rejects.toThrow(
      "Ethereum txlist request failed with HTTP 503 Service Unavailable",
    );
  });

  it("throws a clear transport error for TLS connection resets", async () => {
    const fetchMock = vi.fn(async () => {
      const error = new TypeError("fetch failed") as TypeError & {
        cause?: { code?: string; message?: string };
      };
      error.cause = {
        code: "ECONNRESET",
        message: "Client network socket disconnected before secure TLS connection was established",
      };
      throw error;
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/v2/api",
      chainId: 56,
      name: "BSC",
      useChainIdParam: true,
    });

    await expect(adapter.getEvents({ address: watchedAddress })).rejects.toThrow(
      "BSC txlist request could not reach api.etherscan.io. The current environment reset the TLS connection before it was established.",
    );
  });

  it("retries rate-limited responses and eventually succeeds", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;

      if (calls === 1) {
        return new Response(
          JSON.stringify({
            status: "0",
            message: "NOTOK",
            result: "Max calls per sec rate limit reached (3/sec)",
          }),
          { status: 200 },
        );
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

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/v2/api",
      apiKey: "test-key",
      chainId: 1,
      name: "Ethereum",
      useChainIdParam: true,
      maxRateLimitRetries: 1,
    });

    await expect(adapter.getEvents({ address: watchedAddress })).resolves.toMatchObject({
      events: [],
      coverage: { fetched: 0, truncated: false },
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("paginates Etherscan account actions until a page is short", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get("action");
      const page = Number(url.searchParams.get("page") ?? "1");

      if (action !== "txlist") {
        return new Response(
          JSON.stringify({
            status: "1",
            message: "OK",
            result: [],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          status: "1",
          message: "OK",
          result:
            page === 1
              ? Array.from({ length: 1000 }, (_, index) => ({
                  blockNumber: String(index + 1),
                  timeStamp: String(1_700_000_000 + index),
                  hash: `0x${String(index).padStart(64, "0")}`,
                  from: watchedAddress,
                  to: counterpartyAddress,
                  value: "1",
                  input: "0x",
                  isError: "0",
                  txreceipt_status: "1",
                }))
              : [
                  {
                    blockNumber: "1001",
                    timeStamp: "1700001000",
                    hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    from: watchedAddress,
                    to: counterpartyAddress,
                    value: "1",
                    input: "0x",
                    isError: "0",
                    txreceipt_status: "1",
                  },
                ],
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      chainId: 1,
      name: "Ethereum",
      pageOffset: 1000,
    });

    const { events, coverage } = await adapter.getEvents({
      address: watchedAddress,
      fetchPlan: {
        scope: "full",
        maxEventsPerAddress: 2000,
      },
    });

    expect(events.length).toBeGreaterThan(1000);
    expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input));
      return url.searchParams.get("action") === "txlist" && url.searchParams.get("page") === "2";
    })).toBe(true);
    expect(coverage.truncated).toBe(false);
  });

  it("stops window fetches when records fall before fromTimestamp", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const action = url.searchParams.get("action");

      if (action !== "txlist") {
        return new Response(
          JSON.stringify({
            status: "1",
            message: "OK",
            result: [],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          status: "1",
          message: "OK",
          result: [
            {
              blockNumber: "200",
              timeStamp: "1700000000",
              hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
              from: watchedAddress,
              to: counterpartyAddress,
              value: "1",
              input: "0x",
              isError: "0",
              txreceipt_status: "1",
            },
            {
              blockNumber: "199",
              timeStamp: "1600000000",
              hash: "0x8888888888888888888888888888888888888888888888888888888888888888",
              from: watchedAddress,
              to: counterpartyAddress,
              value: "1",
              input: "0x",
              isError: "0",
              txreceipt_status: "1",
            },
          ],
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      chainId: 1,
      name: "Ethereum",
    });

    const { events } = await adapter.getEvents({
      address: watchedAddress,
      fetchPlan: {
        scope: "window",
        fromTimestamp: 1650000000,
        maxEventsPerAddress: 1000,
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.txHash).toBe(
      "0x9999999999999999999999999999999999999999999999999999999999999999",
    );
  });
});

function mockEtherscanFetch(payloads: {
  txlist: Array<Record<string, string>>;
  txlistinternal: Array<Record<string, string>>;
  tokentx: Array<Record<string, string>>;
  tokennfttx: Array<Record<string, string>>;
}) {
  return vi.fn(async (input: string | URL) => {
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
        result: payloads[action],
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
