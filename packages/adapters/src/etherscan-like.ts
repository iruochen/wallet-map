import type { Address, ChainId, NormalizedEvent, TxHash } from "@wallet-map/core";
import type { AdapterRequest, ChainAdapter } from "./index";

export interface EtherscanLikeAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  chainId: ChainId;
  name: string;
  useChainIdParam?: boolean;
  requestThrottleMs?: number;
  maxRateLimitRetries?: number;
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

interface EtherscanInternalTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  isError?: string;
  errCode?: string;
  contractAddress?: string;
  traceId?: string;
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

interface EtherscanNftTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenSymbol?: string;
  tokenID?: string;
  logIndex?: string;
}

type EtherscanAction = "txlist" | "txlistinternal" | "tokentx" | "tokennfttx";

export class EtherscanLikeAdapter implements ChainAdapter {
  readonly id: string;
  readonly name: string;
  readonly chainId: ChainId;

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly useChainIdParam: boolean;
  private readonly requestThrottleMs: number;
  private readonly maxRateLimitRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: EtherscanLikeAdapterConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey?.trim() || undefined;
    this.chainId = config.chainId;
    this.name = config.name;
    this.id = `etherscan-like:${config.chainId}:${slugify(config.name)}`;
    this.useChainIdParam = config.useChainIdParam ?? false;
    this.requestThrottleMs = Math.max(0, config.requestThrottleMs ?? 0);
    this.maxRateLimitRetries = Math.max(0, config.maxRateLimitRetries ?? 2);
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  async getEvents(request: AdapterRequest): Promise<NormalizedEvent[]> {
    const nativeTransfers = await this.fetchAccountAction<EtherscanNativeTx[]>(request, "txlist");
    const internalTransfers = await this.fetchAccountAction<EtherscanInternalTx[]>(
      request,
      "txlistinternal",
    );
    const tokenTransfers = await this.fetchAccountAction<EtherscanTokenTx[]>(request, "tokentx");
    const nftTransfers = await this.fetchAccountAction<EtherscanNftTx[]>(request, "tokennfttx");

    return [
      ...nativeTransfers.filter(isNativeTransferTx).map((tx) => this.mapNativeTransfer(tx)),
      ...nativeTransfers.filter(isContractCallTx).map((tx) => this.mapContractCall(tx)),
      ...internalTransfers
        .filter(isSuccessfulInternalTx)
        .map((tx) => this.mapInternalTransfer(tx)),
      ...tokenTransfers.map((tx) => this.mapTokenTransfer(tx)),
      ...nftTransfers.map((tx) => this.mapNftTransfer(tx)),
    ].sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber - right.blockNumber;
      }

      return left.id.localeCompare(right.id);
    });
  }

  private async fetchAccountAction<T>(
    request: AdapterRequest,
    action: EtherscanAction,
  ): Promise<T> {
    if (this.requestThrottleMs > 0) {
      await sleep(this.requestThrottleMs);
    }

    let attempt = 0;

    while (true) {
      const url = this.buildAccountUrl(request, action);
      const response = await this.fetchImpl(url).catch((error: unknown) => {
        throw wrapTransportError({
          error,
          action,
          chainName: this.name,
          host: url.host,
        });
      });

      if (!response.ok) {
        if (response.status === 429 && attempt < this.maxRateLimitRetries) {
          attempt += 1;
          await sleep(backoffDelay(this.requestThrottleMs, attempt));
          continue;
        }

        throw new Error(
          `${this.name} ${action} request failed with HTTP ${response.status} ${response.statusText}`.trim(),
        );
      }

      const payload = (await response.json()) as EtherscanResponse<T>;

      if (payload.status === "0" && Array.isArray(payload.result) && payload.result.length === 0) {
        return payload.result as T;
      }

      if (payload.status === "0") {
        if (isRateLimitResult(payload.result) && attempt < this.maxRateLimitRetries) {
          attempt += 1;
          await sleep(backoffDelay(this.requestThrottleMs, attempt));
          continue;
        }

        throw new Error(
          `${this.name} ${action} request failed: ${payload.message} (${formatResult(payload.result)})`,
        );
      }

      if (!Array.isArray(payload.result)) {
        throw new Error(`${this.name} ${action} request returned an unexpected result shape`);
      }

      return payload.result as T;
    }
  }

  private buildAccountUrl(request: AdapterRequest, action: EtherscanAction): URL {
    const url = new URL(this.baseUrl);
    if (this.useChainIdParam) {
      url.searchParams.set("chainid", String(this.chainId));
    }
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

  private mapContractCall(tx: EtherscanNativeTx): NormalizedEvent {
    const input = tx.input ?? "0x";

    return {
      id: `etherscan:${this.chainId}:contract:${tx.hash.toLowerCase()}`,
      type: "contract_call",
      chainId: this.chainId,
      txHash: normalizeTxHash(tx.hash),
      blockNumber: Number(tx.blockNumber),
      timestamp: toIsoTimestamp(tx.timeStamp),
      from: normalizeAddress(tx.from),
      contract: normalizeAddress(tx.to),
      methodId: getMethodId(input),
      metadata: {
        source: this.id,
        input,
        value: tx.value,
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

  private mapInternalTransfer(tx: EtherscanInternalTx): NormalizedEvent {
    return {
      id: `etherscan:${this.chainId}:txlistinternal:${tx.hash.toLowerCase()}:${tx.traceId ?? "0"}`,
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
        transferScope: "internal",
        contractAddress: tx.contractAddress,
        traceId: tx.traceId,
      },
    };
  }

  private mapNftTransfer(tx: EtherscanNftTx): NormalizedEvent {
    return {
      id: `etherscan:${this.chainId}:tokennfttx:${tx.hash.toLowerCase()}:${tx.logIndex ?? tx.tokenID ?? "0"}`,
      type: "nft_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(tx.hash),
      blockNumber: Number(tx.blockNumber),
      timestamp: toIsoTimestamp(tx.timeStamp),
      from: normalizeAddress(tx.from),
      to: normalizeAddress(tx.to),
      contract: normalizeAddress(tx.contractAddress),
      asset: {
        kind: "erc721",
        chainId: this.chainId,
        symbol: tx.tokenSymbol,
        contract: normalizeAddress(tx.contractAddress),
        tokenId: tx.tokenID,
      },
      metadata: {
        source: this.id,
        logIndex: tx.logIndex,
      },
    };
  }
}

function isSuccessfulNativeTx(tx: EtherscanNativeTx): boolean {
  return tx.isError !== "1" && tx.txreceipt_status !== "0";
}

function isNativeTransferTx(tx: EtherscanNativeTx): boolean {
  return isSuccessfulNativeTx(tx) && (!tx.input || tx.input === "0x");
}

function isContractCallTx(tx: EtherscanNativeTx): tx is EtherscanNativeTx & { to: string; input: string } {
  return isSuccessfulNativeTx(tx) && Boolean(tx.to) && Boolean(tx.input) && tx.input !== "0x";
}

function isSuccessfulInternalTx(tx: EtherscanInternalTx): boolean {
  return tx.isError !== "1" && (!tx.errCode || tx.errCode === "");
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

function getMethodId(input: string): string | undefined {
  if (!input.startsWith("0x") || input.length < 10) {
    return undefined;
  }

  return input.slice(0, 10);
}

function formatResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result);
}

function isRateLimitResult(result: unknown): boolean {
  return typeof result === "string" && /rate limit/i.test(result);
}

function backoffDelay(baseDelayMs: number, attempt: number): number {
  return Math.max(250, baseDelayMs || 250) * attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function wrapTransportError(input: {
  error: unknown;
  action: EtherscanAction;
  chainName: string;
  host: string;
}): Error {
  const { error, action, chainName, host } = input;

  if (error instanceof Error) {
    const cause = "cause" in error ? (error.cause as { code?: string; message?: string } | undefined) : undefined;
    const code = cause?.code;

    if (code === "ECONNRESET") {
      return new Error(
        `${chainName} ${action} request could not reach ${host}. The current environment reset the TLS connection before it was established.`,
      );
    }

    return new Error(`${chainName} ${action} request failed before a response was received: ${error.message}`);
  }

  return new Error(`${chainName} ${action} request failed before a response was received.`);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
