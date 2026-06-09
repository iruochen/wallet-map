import { createPostgresAnalysisStorage, ensureStorageMigrations } from "@wallet-map/storage";
import { getPostgresPool } from "../../../lib/server-db";

let analysisStorage: ReturnType<typeof createPostgresAnalysisStorage> | undefined;
let analysisStorageReady: Promise<ReturnType<typeof createPostgresAnalysisStorage> | undefined> | undefined;

export async function getAnalysisStorage() {
  if (analysisStorage) {
    return analysisStorage;
  }

  if (!analysisStorageReady) {
    analysisStorageReady = initializeAnalysisStorage();
  }

  return analysisStorageReady;
}

async function initializeAnalysisStorage() {
  const pool = getPostgresPool();

  if (!pool) {
    return undefined;
  }

  try {
    await ensureStorageMigrations(pool);
    analysisStorage = createPostgresAnalysisStorage(pool);
    return analysisStorage;
  } catch {
    analysisStorageReady = undefined;
    return undefined;
  }
}

export function resetAnalysisStorageForTests(): void {
  analysisStorage = undefined;
  analysisStorageReady = undefined;
}
