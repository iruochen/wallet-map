import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { STORAGE_MIGRATIONS, type WalletMapStorage } from "./index";

const migrationPath = resolve(
  import.meta.dirname,
  "../migrations/0001_initial_schema.sql",
);

describe("storage package", () => {
  it("exports migration metadata", () => {
    expect(STORAGE_MIGRATIONS).toEqual([
      "0001_initial_schema.sql",
      "0002_analysis_job_metadata.sql",
    ]);
  });

  it("defines the storage repository contract", () => {
    const storage = {
      jobs: {
        create: async () => {
          throw new Error("not implemented");
        },
        findById: async () => undefined,
        markRunning: async () => undefined,
        markCompleted: async () => undefined,
        markFailed: async () => undefined,
      },
      runs: {
        save: async () => undefined,
        findByJobId: async () => undefined,
      },
      labels: {
        findKnownLabels: async () => [],
        upsertKnownLabels: async () => undefined,
      },
    } satisfies WalletMapStorage;

    expect(storage.jobs).toBeDefined();
    expect(storage.runs).toBeDefined();
    expect(storage.labels).toBeDefined();
  });

  it("includes the MVP persistence tables in the initial migration", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS analysis_jobs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS normalized_events");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS graph_nodes");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS graph_edges");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS findings");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS known_labels");
  });
});
