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
      tokentx: [],
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.etherscan.io/api",
      chainId: 1,
      name: "Ethereum",
    });

    const events = await adapter.getEvents({ address: watchedAddress });

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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calledUrl(fetchMock, "txlist").searchParams.has("apikey")).toBe(false);
  });

  it("normalizes token transfers from tokentx responses", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
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
    });

    vi.stubGlobal("fetch", fetchMock);

    const adapter = new EtherscanLikeAdapter({
      baseUrl: "https://api.basescan.org/api",
      apiKey: "test-key",
      chainId: 8453,
      name: "Base",
    });

    const events = await adapter.getEvents({
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

  it("supports Etherscan API V2 chainid requests", async () => {
    const fetchMock = mockEtherscanFetch({
      txlist: [],
      tokentx: [],
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
      tokentx: [],
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

    await expect(adapter.getEvents({ address: watchedAddress })).resolves.toEqual([]);
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
});

function mockEtherscanFetch(payloads: {
  txlist: Array<Record<string, string>>;
  tokentx: Array<Record<string, string>>;
}) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const action = url.searchParams.get("action");

    if (action !== "txlist" && action !== "tokentx") {
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
