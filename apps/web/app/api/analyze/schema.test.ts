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

  it("rejects invalid addresses for the selected chain", () => {
    expect(() => parseAddresses("not-an-address")).toThrow("Invalid wallet address");
  });

  it("keeps Solana addresses case-sensitive", () => {
    expect(parseAddresses("7UXJBG5rvdz3Bqn62zGqv8RHq6fM3gYDQe1JrTnMx9wd", [101])).toEqual([
      "7UXJBG5rvdz3Bqn62zGqv8RHq6fM3gYDQe1JrTnMx9wd",
    ]);
  });

  it("requires at least two addresses", () => {
    expect(() =>
      parseAnalyzeRequest({
        addresses: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        chainId: 1,
      }),
    ).toThrow("At least two wallet addresses are required.");
  });

  it("defaults data mode to auto", () => {
    expect(
      parseAnalyzeRequest({
        addresses: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        chainId: "1",
      }),
    ).toMatchObject({
      dataMode: "auto",
      dataProvider: "auto",
      historyScope: "window",
      historyDays: 365,
    });
  });

  it("parses full history scope", () => {
    expect(
      parseAnalyzeRequest({
        addresses: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        chainId: 1,
        historyScope: "full",
      }),
    ).toMatchObject({
      historyScope: "full",
    });
  });

  it("rejects unknown history scope", () => {
    expect(() =>
      parseAnalyzeRequest({
        addresses: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        chainId: 1,
        historyScope: "recent",
      }),
    ).toThrow('History scope must be "window" or "full".');
  });

  it("rejects unknown data modes", () => {
    expect(() =>
      parseAnalyzeRequest({
        addresses: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        chainId: 1,
        dataMode: "remote",
      }),
    ).toThrow("Data mode must be auto, fixture, or live.");
  });
});
