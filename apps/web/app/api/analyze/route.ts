import { startAnalyzeJob } from "./execute-job";
import { parseAnalyzeRequest } from "./schema";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );
    const jobId = startAnalyzeJob(parsed);

    return Response.json({ jobId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}
