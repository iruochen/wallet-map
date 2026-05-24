import { createDefaultAnalyzers } from "@wallet-map/analyzers";
import { runAnalysis, type NormalizedEvent } from "@wallet-map/core";
import fixtureEvents from "../../../../../fixtures/sample-events.json";
import { parseAnalyzeRequest } from "./schema";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as unknown;
    const parsed = parseAnalyzeRequest(
      typeof body === "object" && body !== null ? body : {},
    );
    const events = (fixtureEvents as NormalizedEvent[]).filter((event) => {
      return event.chainId === parsed.chainId;
    });
    const result = await runAnalysis({
      watchedAddresses: parsed.addresses,
      events,
      analyzers: createDefaultAnalyzers(),
    });

    return Response.json({
      mode: "fixture",
      input: parsed,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected analysis error.";

    return Response.json({ error: message }, { status: 400 });
  }
}
