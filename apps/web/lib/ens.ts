import { createPublicClient, http, type Address } from "viem";
import { mainnet } from "viem/chains";

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getMainnetClient() {
  if (!cachedClient) {
    const rpcUrl = process.env.ETHEREUM_RPC_URL?.trim() || "https://cloudflare-eth.com";
    cachedClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 8_000 }),
    });
  }

  return cachedClient;
}

export function normalizeEvmAddress(address: string): Address | null {
  const normalized = address.trim().toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    return null;
  }

  return normalized as Address;
}

export async function resolveEnsName(address: string): Promise<string | null> {
  const normalized = normalizeEvmAddress(address);

  if (!normalized) {
    return null;
  }

  try {
    const name = await getMainnetClient().getEnsName({ address: normalized });
    return name ?? null;
  } catch {
    return null;
  }
}
