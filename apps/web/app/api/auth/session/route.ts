import {
  clearWalletSession,
  readWalletSession,
  verifyWalletSession,
} from "../session";

export async function GET(): Promise<Response> {
  const session = await readWalletSession();

  return Response.json({
    authenticated: Boolean(session),
    address: session?.address,
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      address?: unknown;
      message?: unknown;
      signature?: unknown;
    };

    if (
      typeof body.address !== "string" ||
      typeof body.message !== "string" ||
      typeof body.signature !== "string"
    ) {
      throw new Error("Address, message, and signature are required.");
    }

    const session = await verifyWalletSession({
      address: body.address,
      message: body.message,
      signature: body.signature,
    });

    return Response.json({
      authenticated: true,
      address: session.address,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wallet login failed.";

    return Response.json({ error: message, authenticated: false }, { status: 400 });
  }
}

export async function DELETE(): Promise<Response> {
  await clearWalletSession();

  return Response.json({ authenticated: false });
}
