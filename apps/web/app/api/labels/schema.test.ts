import { describe, expect, it } from "vitest";
import {
  buildLocalLabelRecord,
  localLabelSource,
  parseLabelListQuery,
  parseLocalLabelInput,
} from "./schema";

describe("label management schema", () => {
  it("parses local label payloads into normalized records", () => {
    const input = parseLocalLabelInput({
      nodeKind: "wallet",
      chainId: "1",
      address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      label: "Research Treasury",
      entity: "Internal Research",
      category: "wallet",
      tags: "Team, Watchlist, team",
    });

    expect(input).toEqual({
      nodeKind: "wallet",
      chainId: 1,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      label: "Research Treasury",
      entity: "Internal Research",
      category: "wallet",
      tags: ["team", "watchlist"],
    });
  });

  it("builds stable local-label records", () => {
    const record = buildLocalLabelRecord(
      {
        nodeKind: "wallet",
        chainId: 56,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        label: "Ops wallet",
        tags: [],
      },
      new Date("2026-01-01T00:00:00.000Z"),
    );

    expect(record).toMatchObject({
      id: `wallet:56:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:${localLabelSource}`,
      source: localLabelSource,
      confidence: 1,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      lastSeenAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("rejects invalid local label addresses", () => {
    expect(() =>
      parseLocalLabelInput({
        chainId: 1,
        address: "not-an-address",
        label: "Bad address",
      }),
    ).toThrow("A valid EVM address is required.");
  });

  it("parses list query filters", () => {
    const query = parseLabelListQuery(
      new URL("https://wallet-map.test/api/labels?chainId=56&query=cex&source=local-labels&limit=500"),
    );

    expect(query).toEqual({
      chainId: 56,
      query: "cex",
      source: "local-labels",
      sourceMode: "all",
      limit: 100,
      offset: 0,
    });
  });

  it("parses pagination and source mode query params", () => {
    const query = parseLabelListQuery(
      new URL("https://wallet-map.test/api/labels?sourceMode=discovered&offset=40&limit=25"),
    );

    expect(query).toEqual({
      chainId: undefined,
      query: undefined,
      source: undefined,
      sourceMode: "discovered",
      limit: 25,
      offset: 40,
    });
  });
});
