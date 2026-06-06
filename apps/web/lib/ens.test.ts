import { describe, expect, it } from "vitest";
import { normalizeEvmAddress } from "./ens";

describe("normalizeEvmAddress", () => {
  it("accepts lowercase EVM addresses", () => {
    expect(normalizeEvmAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });

  it("rejects invalid addresses", () => {
    expect(normalizeEvmAddress("ruochen.eth")).toBeNull();
    expect(normalizeEvmAddress("0xshort")).toBeNull();
  });
});
