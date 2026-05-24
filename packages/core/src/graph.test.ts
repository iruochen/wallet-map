import { describe, expect, it } from "vitest";
import { buildRelationshipGraph, getContractNodeId, getWalletNodeId } from "./graph";

describe("buildRelationshipGraph", () => {
  it("builds wallet nodes and transfer edges from normalized events", () => {
    const graph = buildRelationshipGraph({
      watchedAddresses: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
      events: [
        {
          id: "event:1",
          type: "native_transfer",
          chainId: 1,
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          blockNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
          from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          amount: "10000000000000000",
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: getWalletNodeId(1, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
          kind: "wallet",
          tags: ["watched"],
        }),
        expect.objectContaining({
          id: getWalletNodeId(1, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
          kind: "wallet",
          tags: ["watched"],
        }),
      ]),
    );
    expect(graph.edges).toEqual([
      expect.objectContaining({
        kind: "native_transfer",
        source: getWalletNodeId(1, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        target: getWalletNodeId(1, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
        evidenceEventIds: ["event:1"],
      }),
    ]);
  });

  it("adds observed wallet nodes for external transfer counterparties", () => {
    const graph = buildRelationshipGraph({
      watchedAddresses: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      events: [
        {
          id: "event:1",
          type: "token_transfer",
          chainId: 1,
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          blockNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
          from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: getWalletNodeId(1, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
          tags: ["observed"],
        }),
      ]),
    );
  });

  it("builds contract interaction edges", () => {
    const graph = buildRelationshipGraph({
      watchedAddresses: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      events: [
        {
          id: "event:1",
          type: "contract_call",
          chainId: 1,
          txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
          blockNumber: 1,
          timestamp: "2024-01-01T00:00:00.000Z",
          from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          contract: "0xcccccccccccccccccccccccccccccccccccccccc",
          methodId: "0x12345678",
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: getContractNodeId(1, "0xcccccccccccccccccccccccccccccccccccccccc"),
          kind: "contract",
        }),
      ]),
    );
    expect(graph.edges).toEqual([
      expect.objectContaining({
        kind: "contract_interaction",
        source: getWalletNodeId(1, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        target: getContractNodeId(1, "0xcccccccccccccccccccccccccccccccccccccccc"),
        evidenceEventIds: ["event:1"],
      }),
    ]);
  });
});
