import { createWalletChallenge } from "../session";

export async function POST(): Promise<Response> {
  const challenge = await createWalletChallenge();

  return Response.json({ message: challenge.message });
}
