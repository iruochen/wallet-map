import type { Address, ChainId, NormalizedEvent, TxHash } from "@wallet-map/core";
import type { AdapterRequest, ChainAdapter } from "./index";

export interface SolscanAdapterConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  pageSize?: number;
  maxPages?: number;
  requestThrottleMs?: number;
}

interface SolscanResponse<T> {
  success?: boolean;
  data?: T;
  errors?: {
    code?: number;
    message?: string;
  };
}

interface SolscanTransfer {
  trans_id?: string;
  signature?: string;
  block_id?: number;
  block_time?: number;
  from_address?: string;
  to_address?: string;
  token_address?: string;
  token_decimals?: number;
  token_symbol?: string;
  amount?: number | string;
  flow?: "in" | "out";
  activity_type?: string;
  token_id?: string;
}

const solanaChainId = 101 as ChainId;

export class SolscanAdapter implements ChainAdapter {
  readonly id = "solscan:101:solana";
  readonly name = "Solscan";
  readonly chainId = solanaChainId;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly pageSize: number;
  private readonly maxPages: number;
  private readonly requestThrottleMs: number;

  constructor(config: SolscanAdapterConfig) {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error("Solscan adapter requires an API key.");
    }

    this.apiKey = apiKey;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.baseUrl = config.baseUrl ?? "https://pro-api.solscan.io/v2.0";
    this.pageSize = Math.max(1, Math.min(config.pageSize ?? 100, 100));
    this.maxPages = Math.max(1, config.maxPages ?? 3);
    this.requestThrottleMs = Math.max(0, config.requestThrottleMs ?? 200);
  }

  async getEvents(request: AdapterRequest): Promise<NormalizedEvent[]> {
    const transfers = await this.fetchTransfers(request.address);

    return transfers
      .flatMap((transfer, index) => this.mapTransfer(transfer, request.address, index))
      .sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) {
          return left.blockNumber - right.blockNumber;
        }

        return left.id.localeCompare(right.id);
      });
  }

  private async fetchTransfers(address: Address): Promise<SolscanTransfer[]> {
    const transfers: SolscanTransfer[] = [];

    for (let page = 1; page <= this.maxPages; page += 1) {
      if (this.requestThrottleMs > 0) {
        await sleep(this.requestThrottleMs);
      }

      const url = new URL(`${this.baseUrl}/account/transfer`);
      url.searchParams.set("address", address);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(this.pageSize));
      url.searchParams.set("sort_by", "block_time");
      url.searchParams.set("sort_order", "desc");

      const response = await this.fetchImpl(url, {
        headers: {
          token: this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Solscan account transfer request failed with HTTP ${response.status} ${response.statusText}`.trim());
      }

      const payload = (await response.json()) as SolscanResponse<SolscanTransfer[]> | SolscanTransfer[];
      const data = Array.isArray(payload) ? payload : payload.data;

      if (!Array.isArray(data)) {
        const errorMessage = Array.isArray(payload)
          ? "unexpected response"
          : payload.errors?.message ?? "unexpected response";
        throw new Error(`Solscan account transfer request failed: ${errorMessage}`);
      }

      transfers.push(...data);

      if (data.length < this.pageSize) {
        break;
      }
    }

    return transfers;
  }

  private mapTransfer(
    transfer: SolscanTransfer,
    requestedAddress: Address,
    index: number,
  ): NormalizedEvent[] {
    const txHash = normalizeTxHash(transfer.trans_id ?? transfer.signature ?? `solscan-${index}`);
    const from = transfer.from_address ? normalizeAddress(transfer.from_address) : undefined;
    const to = transfer.to_address ? normalizeAddress(transfer.to_address) : undefined;

    if (!from || !to) {
      return [];
    }

    const tokenAddress = transfer.token_address
      ? normalizeAddress(transfer.token_address)
      : undefined;
    const decimals = Number.isFinite(transfer.token_decimals)
      ? Number(transfer.token_decimals)
      : undefined;
    const amount = normalizeSolscanAmount(transfer.amount, decimals);
    const isNative = !tokenAddress || transfer.activity_type === "ACTIVITY_NATIVE_TRANSFER";
    const assetKind = isNative ? "native" : transfer.token_id ? "erc721" : "erc20";

    return [
      {
        id: `solscan:${solanaChainId}:${txHash}:${index}:${requestedAddress}`,
        type: isNative ? "native_transfer" : transfer.token_id ? "nft_transfer" : "token_transfer",
        chainId: solanaChainId,
        txHash,
        blockNumber: transfer.block_id ?? 0,
        timestamp: toIsoTimestamp(transfer.block_time),
        from,
        to,
        contract: tokenAddress,
        amount,
        asset: {
          kind: assetKind,
          chainId: solanaChainId,
          symbol: transfer.token_symbol ?? (isNative ? "SOL" : undefined),
          contract: tokenAddress,
          tokenId: transfer.token_id,
        },
        metadata: {
          source: this.id,
          activityType: transfer.activity_type,
          tokenDecimal: decimals !== undefined ? String(decimals) : undefined,
          flow: transfer.flow,
        },
      },
    ];
  }
}

function normalizeAddress(value: string): Address {
  return value.trim() as Address;
}

function normalizeTxHash(value: string): TxHash {
  return value.trim() as TxHash;
}

function normalizeSolscanAmount(value: number | string | undefined, decimals: number | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return undefined;
    }

    if (Number.isInteger(value)) {
      return String(value);
    }

    const scale = 10 ** Math.max(0, decimals ?? 0);
    return String(Math.round(value * scale));
  }

  return value;
}

function toIsoTimestamp(unixSeconds: number | undefined): string {
  if (!unixSeconds) {
    return new Date(0).toISOString();
  }

  return new Date(unixSeconds * 1000).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
