import { describe, expect, it } from "vitest";
import { mergeAddressInput, parseAddressImport } from "./address-import";

describe("parseAddressImport", () => {
  it("parses CSV, TSV, and whitespace separated wallet addresses", () => {
    const result = parseAddressImport(`
      0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
      0xcccccccccccccccccccccccccccccccccccccccc\t0xdddddddddddddddddddddddddddddddddddddddd
    `);

    expect(result.addresses).toEqual([
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "0xcccccccccccccccccccccccccccccccccccccccc",
      "0xdddddddddddddddddddddddddddddddddddddddd",
    ]);
    expect(result.validCount).toBe(4);
    expect(result.duplicateCount).toBe(0);
    expect(result.invalidRows).toEqual([]);
  });

  it("deduplicates EVM addresses case-insensitively", () => {
    const result = parseAddressImport(`
      0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
    `);

    expect(result.addresses).toEqual(["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]);
    expect(result.duplicateCount).toBe(1);
  });

  it("merges pasted or typed additions into a deduplicated address list", () => {
    const result = mergeAddressInput(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    expect(result).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
  });

  it("keeps valid Solana addresses and reports invalid rows", () => {
    const result = parseAddressImport(`
      7UXJBG5rvdz3Bqn62zGqv8RHq6fM3gYDQe1JrTnMx9wd
      not-an-address
    `);

    expect(result.addresses).toEqual(["7UXJBG5rvdz3Bqn62zGqv8RHq6fM3gYDQe1JrTnMx9wd"]);
    expect(result.invalidRows).toEqual([{ row: 3, value: "not-an-address" }]);
  });
});
