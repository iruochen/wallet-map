import { normalizeEvmAddress, resolveEnsName } from "../../../../lib/ens";

export async function GET(request: Request): Promise<Response> {
  const address = new URL(request.url).searchParams.get("address");

  if (!address || !normalizeEvmAddress(address)) {
    return Response.json({ error: "A valid EVM wallet address is required." }, { status: 400 });
  }

  const name = await resolveEnsName(address);

  return Response.json(
    { name },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
