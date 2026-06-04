import { describe, expect, it, vi } from "vitest";
import { ensureStorageMigrations, resetStorageMigrationStateForTests } from "./migrate";

describe("ensureStorageMigrations", () => {
  it("applies migration 0002 when analysis_jobs exists", async () => {
    resetStorageMigrationStateForTests();

    const query = vi.fn(async (sql: string) => {
      if (sql.includes("information_schema.tables")) {
        return { rows: [{ exists: true }] };
      }

      return { rows: [] };
    });

    const pool = { query } as never;

    await ensureStorageMigrations(pool);

    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain("ADD COLUMN IF NOT EXISTS chain_name");
  });
});
