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
      "0003_scoped_event_and_job_subjects.sql",
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
        listKnownLabels: async () => ({
          items: [],
          total: 0,
          limit: 20,
          offset: 0,
          stats: { total: 0, local: 0, discovered: 0 },
        }),
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
    expect(sql).toContain("PRIMARY KEY (analysis_job_id, id)");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS graph_nodes");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS graph_edges");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS findings");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS known_labels");
  });

  it("documents known entity label source priority in the repository query", async () => {
    const source = await readFile(resolve(import.meta.dirname, "./postgres-labels.ts"), "utf8");

    expect(source).toContain("WHEN 'chainbase-address-labels' THEN 0");
    expect(source).toContain("WHEN 'etherscan-nametag' THEN 1");
    expect(source).toContain("WHEN 'known-entity-labels' THEN 2");
    expect(source).toContain("WHEN 'static-label-registry' THEN 3");
  });
});
