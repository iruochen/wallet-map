import { describe, expect, it } from "vitest";
import {
  assertAnalyzeRequestCapacity,
  readAnalyzeRequestBody,
} from "./request-guard";
import type { ParsedAnalyzeRequest } from "./schema";

const parsedBase: ParsedAnalyzeRequest = {
  addresses: [
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ],
  chainId: 1,
  chainIds: [1],
  dataMode: "auto",
  dataProvider: "auto",
  historyScope: "window",
  historyDays: 365,
};

describe("readAnalyzeRequestBody", () => {
  it("parses JSON bodies under the configured byte limit", async () => {
    const body = await readAnalyzeRequestBody(
      new Request("https://wallet-map.test/api/analyze", {
        method: "POST",
        body: JSON.stringify({ addresses: parsedBase.addresses }),
      }),
      1024,
    );

    expect(body).toEqual({ addresses: parsedBase.addresses });
  });

  it("rejects declared bodies over the byte limit before reading", async () => {
    await expect(
      readAnalyzeRequestBody(
        new Request("https://wallet-map.test/api/analyze", {
          method: "POST",
          headers: { "content-length": "2048" },
          body: "{}",
        }),
        1024,
      ),
    ).rejects.toThrow("1 KB or smaller");
  });

  it("rejects invalid JSON", async () => {
    await expect(
      readAnalyzeRequestBody(
        new Request("https://wallet-map.test/api/analyze", {
          method: "POST",
          body: "{",
        }),
      ),
    ).rejects.toThrow("valid JSON");
  });
});

describe("assertAnalyzeRequestCapacity", () => {
  it("allows requests within the tier address limit", () => {
    expect(() => assertAnalyzeRequestCapacity(parsedBase, "anonymous")).not.toThrow();
  });

  it("rejects requests over the tier address limit", () => {
    expect(() =>
      assertAnalyzeRequestCapacity(
        {
          ...parsedBase,
          addresses: Array.from(
            { length: 11 },
            (_, index) => `0x${String(index + 1).padStart(40, "a")}`,
          ),
        },
        "anonymous",
      ),
    ).toThrow("Anonymous plan supports up to 10 addresses");
  });
});
