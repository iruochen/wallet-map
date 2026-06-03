import { createPostgresAnalysisStorage, type PostgresAnalysisStorage } from "@wallet-map/storage";
import { getPostgresPool } from "../../../lib/server-db";

let analysisStorage: PostgresAnalysisStorage | undefined;

export function getAnalysisStorage(): PostgresAnalysisStorage | undefined {
  const pool = getPostgresPool();

  if (!pool) {
    return undefined;
  }

  if (!analysisStorage) {
    analysisStorage = createPostgresAnalysisStorage(pool);
  }

  return analysisStorage;
}

export function resetAnalysisStorageForTests(): void {
  analysisStorage = undefined;
}
