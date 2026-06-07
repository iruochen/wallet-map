import { getLabelRepository } from "./label-storage";
import { buildLocalLabelRecord, parseLabelListQuery, parseLocalLabelInput } from "./schema";

export async function GET(request: Request): Promise<Response> {
  const repository = await getLabelRepository();

  if (!repository) {
    return Response.json({
      labels: [],
      storageEnabled: false,
      error: "Database storage is not configured.",
    });
  }

  try {
    const query = parseLabelListQuery(new URL(request.url));
    const labels = await repository.listKnownLabels(query);

    return Response.json({
      labels,
      storageEnabled: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list known labels.";

    return Response.json({ error: message, labels: [], storageEnabled: true }, { status: 500 });
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

    return Response.json({ label, storageEnabled: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save local label.";

    return Response.json({ error: message }, { status: 400 });
  }
}
