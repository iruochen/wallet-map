import { createDefaultAnalyzers } from "@wallet-map/analyzers";
import { runAnalysis } from "@wallet-map/core";
import { resolveAnalyzeEvents } from "./data-source";
import { parseAnalyzeRequest } from "./schema";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );
    const resolved = await resolveAnalyzeEvents(parsed);
    const result = await runAnalysis({
      watchedAddresses: parsed.addresses,
      events: resolved.events,
      analyzers: createDefaultAnalyzers(),
    });

    return Response.json({
      mode: resolved.mode,
      source: resolved.source,
      input: parsed,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}
