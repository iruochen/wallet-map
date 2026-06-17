import { describe, expect, it } from "vitest";
import { CsvImportAdapter } from "./index";

describe("CsvImportAdapter", () => {
  it("returns events involving the requested address", async () => {
    const adapter = new CsvImportAdapter(1, [
      {
        id: "event:1",
        type: "native_transfer",
        chainId: 1,
        txHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
        blockNumber: 1,
        timestamp: "2024-01-01T00:00:00.000Z",
        from: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ]);

    const { events } = await adapter.getEvents({
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("event:1");
  });
});
