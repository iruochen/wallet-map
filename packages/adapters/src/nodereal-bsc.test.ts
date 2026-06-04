import { describe, expect, it, vi } from "vitest";
import { NodeRealBscAdapter } from "./nodereal-bsc";

describe("NodeRealBscAdapter", () => {
  it("maps external, internal, erc20, and erc721 transfers into normalized events", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              pageKey: "",
              transfers: [
                {
                  id: 1,
                  category: "external",
                  blockNum: "0x64",
                  from: "0x1111111111111111111111111111111111111111",
                  to: "0x2222222222222222222222222222222222222222",
                  value: "0xde0b6b3a7640000",
                  asset: "BNB",
                  hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                  blockTimeStamp: 1710000000,
                  input: "0x",
                  logIndex: 0,
                  traceIndex: 0,
                },
                {
                  id: 2,
                  category: "external",
                  blockNum: "0x65",
                  from: "0x1111111111111111111111111111111111111111",
                  to: "0x3333333333333333333333333333333333333333",
                  value: "0x0",
                  asset: "BNB",
                  hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                  blockTimeStamp: 1710000060,
                  input: "0xa9059cbb00000000000000000000000000000000000000000000000000000000",
                  logIndex: 0,
                  traceIndex: 0,
                },
                {
                  id: 3,
                  category: "internal",
                  blockNum: "0x66",
                  from: "0x3333333333333333333333333333333333333333",
                  to: "0x1111111111111111111111111111111111111111",
                  value: "0x6f05b59d3b20000",
                  asset: "BNB",
                  hash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                  blockTimeStamp: 1710000120,
                  traceIndex: 4,
                  type: "call",
                },
                {
                  id: 4,
                  category: "20",
                  blockNum: "0x67",
                  from: "0x1111111111111111111111111111111111111111",
                  to: "0x4444444444444444444444444444444444444444",
                  value: "0x0de0b6b3a7640000",
                  asset: "USDT",
                  hash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                  contractAddress: "0x5555555555555555555555555555555555555555",
                  decimal: "18",
                  blockTimeStamp: 1710000180,
                  input: "0xa9059cbb0000000000000000000000004444444444444444444444444444444444444444",
                  logIndex: 7,
                },
                {
                  id: 5,
                  category: "721",
                  blockNum: "0x68",
                  from: "0x6666666666666666666666666666666666666666",
                  to: "0x1111111111111111111111111111111111111111",
                  value: "0x0",
                  asset: "BAYC",
                  hash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                  contractAddress: "0x7777777777777777777777777777777777777777",
                  decimal: "0",
                  erc721TokenId: "0x2a",
                  blockTimeStamp: 1710000240,
                  logIndex: 3,
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const adapter = new NodeRealBscAdapter({
      apiKey: "test-key",
      fetchImpl: fetchMock,
      maxPages: 1,
    });

    const events = await adapter.getEvents({
      address: "0x1111111111111111111111111111111111111111",
    });

    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({
      id: "nodereal:56:external:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:1",
      type: "native_transfer",
      chainId: 56,
      amount: "1000000000000000000",
    });
    expect(events[1]).toMatchObject({
      id: "nodereal:56:contract:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:2",
      type: "contract_call",
      methodId: "0xa9059cbb",
      contract: "0x3333333333333333333333333333333333333333",
    });
    expect(events[2]).toMatchObject({
      id: "nodereal:56:internal:0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc:3:4",
      type: "native_transfer",
      amount: "500000000000000000",
      metadata: {
        source: "nodereal:56:bsc",
        transferScope: "internal",
        traceId: "4",
        traceType: "call",
      },
    });
    expect(events[3]).toMatchObject({
      id: "nodereal:56:20:0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd:4:7",
      type: "token_transfer",
      amount: "1000000000000000000",
      contract: "0x5555555555555555555555555555555555555555",
      asset: {
        kind: "erc20",
        symbol: "USDT",
        contract: "0x5555555555555555555555555555555555555555",
      },
    });
    expect(events[4]).toMatchObject({
      id: "nodereal:56:721:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee:5:3",
      type: "nft_transfer",
      contract: "0x7777777777777777777777777777777777777777",
      asset: {
        kind: "erc721",
        symbol: "BAYC",
        contract: "0x7777777777777777777777777777777777777777",
        tokenId: "42",
      },
    });
  });

  it("follows pageKey pagination", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              pageKey: "next-page",
              transfers: [],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              pageKey: "",
              transfers: [],
            },
          }),
          { status: 200 },
        ),
      );

    const adapter = new NodeRealBscAdapter({
      apiKey: "test-key",
      fetchImpl: fetchMock,
      maxPages: 4,
    });

    await adapter.getEvents({
      address: "0x1111111111111111111111111111111111111111",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      params: Array<{ pageKey?: string }>;
    };
    expect(secondBody.params[0]?.pageKey).toBe("next-page");
  });

  it("keeps NodeReal records distinct when hash and log index repeat", async () => {
    const repeatedHash = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            pageKey: "",
            transfers: [
              {
                id: 41,
                category: "20",
                blockNum: "0x67",
                from: "0x1111111111111111111111111111111111111111",
                to: "0x2222222222222222222222222222222222222222",
                value: "0x1",
                asset: "USDT",
                hash: repeatedHash,
                contractAddress: "0x3333333333333333333333333333333333333333",
                blockTimeStamp: 1710000180,
                logIndex: 0,
              },
              {
                id: 42,
                category: "20",
                blockNum: "0x67",
                from: "0x1111111111111111111111111111111111111111",
                to: "0x4444444444444444444444444444444444444444",
                value: "0x2",
                asset: "USDT",
                hash: repeatedHash,
                contractAddress: "0x3333333333333333333333333333333333333333",
                blockTimeStamp: 1710000180,
                logIndex: 0,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const adapter = new NodeRealBscAdapter({
      apiKey: "test-key",
      fetchImpl: fetchMock,
      maxPages: 1,
    });

    const events = await adapter.getEvents({
      address: "0x1111111111111111111111111111111111111111",
    });

    expect(events.map((event) => event.id)).toEqual([
      `nodereal:56:20:${repeatedHash}:41:0`,
      `nodereal:56:20:${repeatedHash}:42:0`,
    ]);
  });
});
