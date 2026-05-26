import type { Address, ChainId, NormalizedEvent, TxHash } from "@wallet-map/core";
import type { AdapterRequest, ChainAdapter } from "./index";

export interface NodeRealBscAdapterConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  maxPages?: number;
  maxCountPerPage?: number;
  requestThrottleMs?: number;
  maxRateLimitRetries?: number;
}

interface NodeRealRpcError {
  code: number;
  message: string;
}

interface NodeRealRpcResponse<T> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: NodeRealRpcError;
}

interface NodeRealTransferPage {
  pageKey?: string;
  transfers: NodeRealTransfer[];
}

interface NodeRealTransfer {
  id: number;
  category: "external" | "internal" | "20" | "721" | "1155";
  blockNum: string;
  from: string;
  to: string;
  value?: string;
  amount?: string;
  asset?: string;
  name?: string;
  hash: string;
  contractAddress?: string;
  decimal?: string;
  blockTimeStamp: number;
  gasPrice?: number | string;
  gasUsed?: number | string;
  receiptsStatus?: number | string;
  gas?: number | string;
  input?: string;
  logIndex?: number | string;
  traceIndex?: number | string;
  type?: string;
  erc721TokenId?: string;
  erc1155Metadata?: Array<{ tokenId?: string; value?: string }>;
  txType?: string;
}

const chainId = 56 as ChainId;
const baseUrlPrefix = "https://bsc-mainnet.nodereal.io/v1/";
const categoryList = ["external", "internal", "20", "721", "1155"] as const;

export class NodeRealBscAdapter implements ChainAdapter {
  readonly id = "nodereal:56:bsc";
  readonly name = "NodeReal BSC";
  readonly chainId = chainId;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxPages: number;
  private readonly maxCountPerPage: number;
  private readonly requestThrottleMs: number;
  private readonly maxRateLimitRetries: number;

  constructor(config: NodeRealBscAdapterConfig) {
    const apiKey = config.apiKey.trim();

    if (!apiKey) {
      throw new Error("NodeReal BSC adapter requires an API key.");
    }

    this.baseUrl = `${baseUrlPrefix}${apiKey}`;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.maxPages = Math.max(1, config.maxPages ?? 8);
    this.maxCountPerPage = Math.max(1, config.maxCountPerPage ?? 100);
    this.requestThrottleMs = Math.max(0, config.requestThrottleMs ?? 200);
    this.maxRateLimitRetries = Math.max(0, config.maxRateLimitRetries ?? 2);
  }

  async getEvents(request: AdapterRequest): Promise<NormalizedEvent[]> {
    const transfers = await this.fetchTransfers(request);

    return transfers
      .flatMap((transfer) => this.mapTransfer(transfer))
      .sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) {
          return left.blockNumber - right.blockNumber;
        }

        return left.id.localeCompare(right.id);
      });
  }

  private async fetchTransfers(request: AdapterRequest): Promise<NodeRealTransfer[]> {
    const transfers: NodeRealTransfer[] = [];
    let pageKey: string | undefined;

    for (let page = 0; page < this.maxPages; page += 1) {
      if (this.requestThrottleMs > 0) {
        await sleep(this.requestThrottleMs);
      }

      const payload = await this.callRpc<NodeRealTransferPage>({
        method: "nr_getTransactionByAddress",
        params: [
          {
            address: request.address,
            category: [...categoryList],
            maxCount: toRpcHex(this.maxCountPerPage),
            ...(request.range?.fromBlock !== undefined
              ? { fromBlock: toRpcHex(request.range.fromBlock) }
              : {}),
            ...(request.range?.toBlock !== undefined
              ? { toBlock: toRpcHex(request.range.toBlock) }
              : {}),
            ...(pageKey ? { pageKey } : {}),
          },
        ],
      });

      transfers.push(...payload.transfers);

      if (!payload.pageKey || payload.pageKey === pageKey) {
        break;
      }

      pageKey = payload.pageKey;
    }

    return transfers;
  }

  private async callRpc<T>(input: {
    method: string;
    params: unknown[];
  }): Promise<T> {
    let attempt = 0;

    while (true) {
      const response = await this.fetchImpl(this.baseUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: input.method,
          params: input.params,
        }),
      }).catch((error: unknown) => {
        throw wrapTransportError(error);
      });

      if (!response.ok) {
        if (response.status === 429 && attempt < this.maxRateLimitRetries) {
          attempt += 1;
          await sleep(backoffDelay(this.requestThrottleMs, attempt));
          continue;
        }

        throw new Error(
          `NodeReal BSC ${input.method} request failed with HTTP ${response.status} ${response.statusText}`.trim(),
        );
      }

      const payload = (await response.json()) as NodeRealRpcResponse<T>;

      if (payload.error) {
        if (isRetryableRpcError(payload.error) && attempt < this.maxRateLimitRetries) {
          attempt += 1;
          await sleep(backoffDelay(this.requestThrottleMs, attempt));
          continue;
        }

        throw new Error(`NodeReal BSC ${input.method} request failed: ${payload.error.message}`);
      }

      if (payload.result === undefined) {
        throw new Error(`NodeReal BSC ${input.method} request returned no result`);
      }

      return payload.result;
    }
  }

  private mapTransfer(transfer: NodeRealTransfer): NormalizedEvent[] {
    switch (transfer.category) {
      case "external":
        if (isContractCall(transfer)) {
          return [this.mapContractCall(transfer)];
        }

        if (isNativeTransfer(transfer)) {
          return [this.mapNativeTransfer(transfer)];
        }

        return [];
      case "internal":
        return [this.mapInternalTransfer(transfer)];
      case "20":
        return [this.mapTokenTransfer(transfer)];
      case "721":
        return [this.mapErc721Transfer(transfer)];
      case "1155":
        return this.mapErc1155Transfer(transfer);
      default:
        return [];
    }
  }

  private mapNativeTransfer(transfer: NodeRealTransfer): NormalizedEvent {
    return {
      id: `nodereal:${chainId}:external:${transfer.hash.toLowerCase()}`,
      type: "native_transfer",
      chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      asset: {
        kind: "native",
        chainId,
      },
      amount: hexToDecimalString(transfer.value),
      metadata: {
        source: this.id,
        input: transfer.input,
        gasUsed: transfer.gasUsed,
      },
    };
  }

  private mapContractCall(transfer: NodeRealTransfer): NormalizedEvent {
    const input = transfer.input ?? "0x";

    return {
      id: `nodereal:${chainId}:contract:${transfer.hash.toLowerCase()}`,
      type: "contract_call",
      chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      contract: normalizeAddress(transfer.to),
      methodId: getMethodId(input),
      metadata: {
        source: this.id,
        input,
        value: hexToDecimalString(transfer.value),
      },
    };
  }

  private mapInternalTransfer(transfer: NodeRealTransfer): NormalizedEvent {
    return {
      id: `nodereal:${chainId}:internal:${transfer.hash.toLowerCase()}:${String(transfer.traceIndex ?? 0)}`,
      type: "native_transfer",
      chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      asset: {
        kind: "native",
        chainId,
      },
      amount: hexToDecimalString(transfer.value),
      metadata: {
        source: this.id,
        transferScope: "internal",
        traceId: String(transfer.traceIndex ?? 0),
        traceType: transfer.type,
      },
    };
  }

  private mapTokenTransfer(transfer: NodeRealTransfer): NormalizedEvent {
    return {
      id: `nodereal:${chainId}:20:${transfer.hash.toLowerCase()}:${String(transfer.logIndex ?? 0)}`,
      type: "token_transfer",
      chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      asset: {
        kind: "erc20",
        chainId,
        symbol: transfer.asset,
        contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      },
      amount: hexToDecimalString(transfer.value),
      metadata: {
        source: this.id,
        tokenDecimal: transfer.decimal,
        logIndex: String(transfer.logIndex ?? 0),
      },
    };
  }

  private mapErc721Transfer(transfer: NodeRealTransfer): NormalizedEvent {
    return {
      id: `nodereal:${chainId}:721:${transfer.hash.toLowerCase()}:${String(transfer.logIndex ?? 0)}`,
      type: "nft_transfer",
      chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      asset: {
        kind: "erc721",
        chainId,
        symbol: transfer.asset,
        contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
        tokenId: hexToDecimalString(transfer.erc721TokenId),
      },
      metadata: {
        source: this.id,
        tokenDecimal: transfer.decimal,
        logIndex: String(transfer.logIndex ?? 0),
      },
    };
  }

  private mapErc1155Transfer(transfer: NodeRealTransfer): NormalizedEvent[] {
    const tokenDetails = transfer.erc1155Metadata?.length
      ? transfer.erc1155Metadata
      : [{ tokenId: undefined, value: transfer.value }];

    return tokenDetails.map((detail, index) => ({
      id: `nodereal:${chainId}:1155:${transfer.hash.toLowerCase()}:${String(transfer.logIndex ?? 0)}:${index}`,
      type: "nft_transfer",
      chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      asset: {
        kind: "erc1155",
        chainId,
        symbol: transfer.asset,
        contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
        tokenId: hexToDecimalString(detail.tokenId),
      },
      amount: hexToDecimalString(detail.value),
      metadata: {
        source: this.id,
        tokenDecimal: transfer.decimal,
        logIndex: String(transfer.logIndex ?? 0),
      },
    }));
  }
}

function isNativeTransfer(transfer: NodeRealTransfer): boolean {
  return (transfer.input === undefined || transfer.input === "0x") && hexToBigInt(transfer.value) > 0n;
}

function isContractCall(transfer: NodeRealTransfer): boolean {
  return Boolean(transfer.to) && Boolean(transfer.input) && transfer.input !== "0x";
}

function normalizeAddress(value: string): Address {
  return value.toLowerCase() as Address;
}

function normalizeTxHash(value: string): TxHash {
  return value.toLowerCase() as TxHash;
}

function toIsoTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

function getMethodId(input: string): string | undefined {
  if (!input.startsWith("0x") || input.length < 10) {
    return undefined;
  }

  return input.slice(0, 10);
}

function hexToBigInt(value: string | undefined): bigint {
  if (!value) {
    return 0n;
  }

  return BigInt(value);
}

function hexToDecimalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return hexToBigInt(value).toString(10);
}

function hexToNumber(value: string): number {
  return Number.parseInt(value, 16);
}

function toRpcHex(value: number): string {
  return `0x${value.toString(16)}`;
}

function backoffDelay(baseDelayMs: number, attempt: number): number {
  return Math.max(250, baseDelayMs || 250) * attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableRpcError(error: NodeRealRpcError): boolean {
  return error.code === -32005 || /rate limit|too many|ran out of cu/i.test(error.message);
}

function wrapTransportError(error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`NodeReal BSC request failed before a response was received: ${error.message}`);
  }

  return new Error("NodeReal BSC request failed before a response was received.");
}
