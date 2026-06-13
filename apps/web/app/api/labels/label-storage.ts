import { createPostgresLabelRepository, ensureStorageMigrations } from "@wallet-map/storage";
import { readLabelDatabaseEnabled } from "../../../lib/feature-config";
import { getPostgresPool } from "../../../lib/server-db";

let labelRepository:
  | ReturnType<typeof createPostgresLabelRepository>
  | undefined;
let labelRepositoryReady:
  | Promise<ReturnType<typeof createPostgresLabelRepository> | undefined>
  | undefined;

export async function getLabelRepository() {
  if (labelRepository) {
    return labelRepository;
  }

  if (!labelRepositoryReady) {
    labelRepositoryReady = initializeLabelRepository();
  }

  return labelRepositoryReady;
}

async function initializeLabelRepository() {
  if (!readLabelDatabaseEnabled()) {
    return undefined;
  }

  const pool = getPostgresPool();

  if (!pool) {
    return undefined;
  }

  try {
    await ensureStorageMigrations(pool);
    labelRepository = createPostgresLabelRepository({ pool });
    return labelRepository;
  } catch {
    labelRepositoryReady = undefined;
    return undefined;
  }
}

export function resetLabelRepositoryForTests(): void {
  labelRepository = undefined;
  labelRepositoryReady = undefined;
}
