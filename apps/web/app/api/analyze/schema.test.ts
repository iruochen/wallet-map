import { describe, expect, it } from "vitest";
import { parseAddresses, parseAnalyzeRequest } from "./schema";

describe("analyze request schema", () => {
  it("parses and deduplicates addresses", () => {
    expect(
      parseAddresses(`
        0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
        0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
        0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      `),
    ).toEqual([
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ]);
  });

  it("rejects invalid EVM addresses", () => {
    expect(() => parseAddresses("not-an-address")).toThrow("Invalid EVM address");
  });

  it("requires at least two addresses", () => {
    expect(() =>
      parseAnalyzeRequest({
        addresses: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        chainId: 1,
      }),
    ).toThrow("At least two wallet addresses are required.");
  });
});
