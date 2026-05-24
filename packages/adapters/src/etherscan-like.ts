import type { Address, ChainId, NormalizedEvent, TxHash } from "@wallet-map/core";
import type { AdapterRequest, ChainAdapter } from "./index";

export interface EtherscanLikeAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  chainId: ChainId;
  name: string;
  fetchImpl?: typeof fetch;
}

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

interface EtherscanNativeTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  input?: string;
  isError?: string;
  txreceipt_status?: string;
  contractAddress?: string;
}

interface EtherscanTokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  tokenID?: string;
  logIndex?: string;
}

type EtherscanAction = "txlist" | "tokentx";

export class EtherscanLikeAdapter implements ChainAdapter {
  readonly id: string;
  readonly name: string;
  readonly chainId: ChainId;

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: EtherscanLikeAdapterConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey?.trim() || undefined;
    this.chainId = config.chainId;
    this.name = config.name;
    this.id = `etherscan-like:${config.chainId}:${slugify(config.name)}`;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  async getEvents(request: AdapterRequest): Promise<NormalizedEvent[]> {
    const [nativeTransfers, tokenTransfers] = await Promise.all([
      this.fetchAccountAction<EtherscanNativeTx[]>(request, "txlist"),
      this.fetchAccountAction<EtherscanTokenTx[]>(request, "tokentx"),
    ]);

    return [
      ...nativeTransfers.filter(isSuccessfulNativeTx).map((tx) => this.mapNativeTransfer(tx)),
      ...tokenTransfers.map((tx) => this.mapTokenTransfer(tx)),
    ].sort((left, right) => left.blockNumber - right.blockNumber);
  }

  private async fetchAccountAction<T>(
    request: AdapterRequest,
    action: EtherscanAction,
  ): Promise<T> {
    const url = this.buildAccountUrl(request, action);
    const response = await this.fetchImpl(url);

    if (!response.ok) {
      throw new Error(
        `${this.name} ${action} request failed with HTTP ${response.status} ${response.statusText}`.trim(),
      );
    }

    const payload = (await response.json()) as EtherscanResponse<T>;

    if (payload.status === "0" && Array.isArray(payload.result) && payload.result.length === 0) {
      return payload.result as T;
    }

    if (payload.status === "0") {
      throw new Error(
        `${this.name} ${action} request failed: ${payload.message} (${formatResult(payload.result)})`,
      );
    }

    if (!Array.isArray(payload.result)) {
      throw new Error(`${this.name} ${action} request returned an unexpected result shape`);
    }

    return payload.result as T;
  }

  private buildAccountUrl(request: AdapterRequest, action: EtherscanAction): URL {
    const url = new URL(this.baseUrl);
    url.searchParams.set("module", "account");
    url.searchParams.set("action", action);
    url.searchParams.set("address", request.address);
    url.searchParams.set("sort", "asc");

    if (request.range?.fromBlock !== undefined) {
      url.searchParams.set("startblock", String(request.range.fromBlock));
    }

    if (request.range?.toBlock !== undefined) {
      url.searchParams.set("endblock", String(request.range.toBlock));
    }

    if (this.apiKey) {
      url.searchParams.set("apikey", this.apiKey);
    }

    return url;
  }

  private mapNativeTransfer(tx: EtherscanNativeTx): NormalizedEvent {
    return {
      id: `etherscan:${this.chainId}:txlist:${tx.hash.toLowerCase()}`,
      type: "native_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(tx.hash),
      blockNumber: Number(tx.blockNumber),
      timestamp: toIsoTimestamp(tx.timeStamp),
      from: normalizeAddress(tx.from),
      to: normalizeAddress(tx.to),
      asset: {
        kind: "native",
        chainId: this.chainId,
      },
      amount: tx.value,
      metadata: {
        source: this.id,
        input: tx.input,
      },
    };
  }

  private mapTokenTransfer(tx: EtherscanTokenTx): NormalizedEvent {
    return {
      id: `etherscan:${this.chainId}:tokentx:${tx.hash.toLowerCase()}:${tx.logIndex ?? "0"}`,
      type: "token_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(tx.hash),
      blockNumber: Number(tx.blockNumber),
      timestamp: toIsoTimestamp(tx.timeStamp),
      from: normalizeAddress(tx.from),
      to: normalizeAddress(tx.to),
      contract: normalizeAddress(tx.contractAddress),
      asset: {
        kind: tx.tokenID ? "erc721" : "erc20",
        chainId: this.chainId,
        symbol: tx.tokenSymbol,
        contract: normalizeAddress(tx.contractAddress),
        tokenId: tx.tokenID,
      },
      amount: tx.value,
      metadata: {
        source: this.id,
        tokenDecimal: tx.tokenDecimal,
        logIndex: tx.logIndex,
      },
    };
  }
}

function isSuccessfulNativeTx(tx: EtherscanNativeTx): boolean {
  return tx.isError !== "1" && tx.txreceipt_status !== "0";
}

function normalizeAddress(value: string): Address {
  return value.toLowerCase() as Address;
}

function normalizeTxHash(value: string): TxHash {
  return value.toLowerCase() as TxHash;
}

function toIsoTimestamp(unixSeconds: string): string {
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

function formatResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
