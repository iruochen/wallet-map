import { describe, expect, it, vi } from "vitest";
import { ensureStorageMigrations, resetStorageMigrationStateForTests } from "./migrate";

describe("ensureStorageMigrations", () => {
  it("applies pending migrations when analysis_jobs exists", async () => {
    resetStorageMigrationStateForTests();

    const query = vi.fn(async (sql: string) => {
      if (sql.includes("information_schema.tables")) {
        return { rows: [{ exists: true }] };
      }

      return { rows: [] };
    });

    const pool = { query } as never;

    await ensureStorageMigrations(pool);

    expect(query).toHaveBeenCalledTimes(3);
    expect(String(query.mock.calls[1]?.[0])).toContain("ADD COLUMN IF NOT EXISTS chain_name");
    expect(String(query.mock.calls[2]?.[0])).toContain("PRIMARY KEY (analysis_job_id, id)");
  });
});
