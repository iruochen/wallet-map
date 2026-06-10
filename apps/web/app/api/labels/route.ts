import {
  buildLabelListCacheKey,
  invalidateLabelListCache,
  readCachedLabelList,
  writeCachedLabelList,
} from "./label-list-cache";
import { getLabelRepository } from "./label-storage";
import { buildLocalLabelRecord, parseLabelListQuery, parseLocalLabelInput } from "./schema";

export async function GET(request: Request): Promise<Response> {
  const repository = await getLabelRepository();

  if (!repository) {
    return Response.json({
      labels: [],
      total: 0,
      limit: 20,
      offset: 0,
      stats: { total: 0, local: 0, discovered: 0 },
      storageEnabled: false,
      error: "Database storage is not configured.",
    });
  }

  try {
    const query = parseLabelListQuery(new URL(request.url));
    const cacheKey = buildLabelListCacheKey(query);
    const cached = await readCachedLabelList(cacheKey);
    const result =
      cached ??
      (await repository.listKnownLabels({
        chainId: query.chainId,
        source: query.source,
        sourceMode: query.sourceMode,
        query: query.query,
        limit: query.limit,
        offset: query.offset,
      }));

    if (!cached) {
      await writeCachedLabelList(cacheKey, result);
    }

    return Response.json({
      labels: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      stats: result.stats,
      storageEnabled: true,
      cacheHit: Boolean(cached),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list known labels.";

    return Response.json(
      {
        error: message,
        labels: [],
        total: 0,
        limit: 20,
        offset: 0,
        stats: { total: 0, local: 0, discovered: 0 },
        storageEnabled: true,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const repository = await getLabelRepository();

  if (!repository) {
    return Response.json({ error: "Database storage is not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as unknown;
    const input = parseLocalLabelInput(body);
    const label = buildLocalLabelRecord(input);

    await repository.upsertKnownLabels([label]);
    await invalidateLabelListCache();

    return Response.json({ label, storageEnabled: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save local label.";

    return Response.json({ error: message }, { status: 400 });
  }
}
