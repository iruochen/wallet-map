import type { Address, ChainId, NormalizedEvent, TxHash } from "@wallet-map/core";
import type { AdapterFetchResult, AdapterRequest, ChainAdapter } from "./index";
import {
  buildMaxEventsReason,
  capEvents,
  finalizeFetchCoverage,
  resolveAdapterFetchPlan,
} from "./fetch-helpers";

export interface NodeRealBscAdapterConfig {
  apiKey: string;
  chainId?: ChainId;
  name?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
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

const baseUrlPrefix = "https://bsc-mainnet.nodereal.io/v1/";
const categoryList = ["external", "internal", "20", "721", "1155"] as const;
const maxCountPerPageLimit = 1000;

export class NodeRealEvmAdapter implements ChainAdapter {
  readonly id: string;
  readonly name: string;
  readonly chainId: ChainId;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxCountPerPage: number;
  private readonly requestThrottleMs: number;
  private readonly maxRateLimitRetries: number;

  constructor(config: NodeRealBscAdapterConfig) {
    const apiKey = config.apiKey.trim();

    if (!apiKey) {
      throw new Error("NodeReal EVM adapter requires an API key.");
    }

    this.chainId = config.chainId ?? (56 as ChainId);
    this.name = config.name ?? "NodeReal BSC";
    this.id = `nodereal:${this.chainId}:${slugify(this.name.replace(/^NodeReal\s+/i, ""))}`;
    this.baseUrl = config.baseUrl ?? `${baseUrlPrefix}${apiKey}`;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.maxCountPerPage = Math.max(1, Math.min(config.maxCountPerPage ?? maxCountPerPageLimit, maxCountPerPageLimit));
    this.requestThrottleMs = Math.max(0, config.requestThrottleMs ?? 200);
    this.maxRateLimitRetries = Math.max(0, config.maxRateLimitRetries ?? 2);
  }

  async getEvents(request: AdapterRequest): Promise<AdapterFetchResult> {
    const plan = resolveAdapterFetchPlan(request.fetchPlan);
    const fetchResult = await this.fetchTransfers(request, plan);
    const mapped = fetchResult.transfers
      .flatMap((transfer) => this.mapTransfer(transfer))
      .sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) {
          return left.blockNumber - right.blockNumber;
        }

        return left.id.localeCompare(right.id);
      });
    const capped = capEvents(mapped, plan.maxEventsPerAddress);

    return {
      events: capped.events,
      coverage: finalizeFetchCoverage(capped.events, {
        truncated: fetchResult.truncated || capped.truncated,
        reason:
          fetchResult.reason ??
          (capped.truncated ? buildMaxEventsReason(plan.maxEventsPerAddress) : undefined),
      }),
    };
  }

  private async fetchTransfers(
    request: AdapterRequest,
    plan: ReturnType<typeof resolveAdapterFetchPlan>,
  ): Promise<{ transfers: NodeRealTransfer[]; truncated: boolean; reason?: string }> {
    const transfers: NodeRealTransfer[] = [];
    let pageKey: string | undefined;
    const order = plan.scope === "window" ? "desc" : "asc";
    let truncated = false;
    let reason: string | undefined;

    while (transfers.length < plan.maxEventsPerAddress) {
      if (this.requestThrottleMs > 0) {
        await sleep(this.requestThrottleMs);
      }

      const payload = await this.callRpc<NodeRealTransferPage>({
        method: "nr_getTransactionByAddress",
        params: [
          {
            address: request.address,
            category: [...categoryList],
            order,
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

      const pageTransfers = payload.transfers ?? [];

      if (plan.scope === "window" && plan.fromTimestamp !== undefined) {
        const inWindow = pageTransfers.filter((transfer) => transfer.blockTimeStamp >= plan.fromTimestamp!);
        transfers.push(...inWindow);

        if (pageTransfers.length > 0) {
          const oldestInPage = Math.min(...pageTransfers.map((transfer) => transfer.blockTimeStamp));
          if (oldestInPage < plan.fromTimestamp) {
            break;
          }
        }
      } else {
        transfers.push(...pageTransfers);
      }

      if (!payload.pageKey || payload.pageKey === pageKey) {
        break;
      }

      if (transfers.length >= plan.maxEventsPerAddress) {
        truncated = true;
        reason = buildMaxEventsReason(plan.maxEventsPerAddress);
        break;
      }

      pageKey = payload.pageKey;
    }

    return {
      transfers: transfers.slice(0, plan.maxEventsPerAddress),
      truncated,
      reason,
    };
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
          `${this.name} ${input.method} request failed with HTTP ${response.status} ${response.statusText}`.trim(),
        );
      }

      const payload = (await response.json()) as NodeRealRpcResponse<T>;

      if (payload.error) {
        if (isRetryableRpcError(payload.error) && attempt < this.maxRateLimitRetries) {
          attempt += 1;
          await sleep(backoffDelay(this.requestThrottleMs, attempt));
          continue;
        }

        throw new Error(`${this.name} ${input.method} request failed: ${payload.error.message}`);
      }

      if (payload.result === undefined) {
        throw new Error(`${this.name} ${input.method} request returned no result`);
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
      id: `nodereal:${this.chainId}:external:${buildTransferEventKey(transfer)}`,
      type: "native_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      asset: {
        kind: "native",
        chainId: this.chainId,
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
      id: `nodereal:${this.chainId}:contract:${buildTransferEventKey(transfer)}`,
      type: "contract_call",
      chainId: this.chainId,
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
      id: `nodereal:${this.chainId}:internal:${buildTransferEventKey(transfer)}:${String(transfer.traceIndex ?? 0)}`,
      type: "native_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      asset: {
        kind: "native",
        chainId: this.chainId,
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
      id: `nodereal:${this.chainId}:20:${buildTransferEventKey(transfer)}:${String(transfer.logIndex ?? 0)}`,
      type: "token_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      asset: {
        kind: "erc20",
        chainId: this.chainId,
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
      id: `nodereal:${this.chainId}:721:${buildTransferEventKey(transfer)}:${String(transfer.logIndex ?? 0)}`,
      type: "nft_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      asset: {
        kind: "erc721",
        chainId: this.chainId,
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
      id: `nodereal:${this.chainId}:1155:${buildTransferEventKey(transfer)}:${String(transfer.logIndex ?? 0)}:${index}`,
      type: "nft_transfer",
      chainId: this.chainId,
      txHash: normalizeTxHash(transfer.hash),
      blockNumber: hexToNumber(transfer.blockNum),
      timestamp: toIsoTimestamp(transfer.blockTimeStamp),
      from: normalizeAddress(transfer.from),
      to: normalizeAddress(transfer.to),
      contract: normalizeAddress(transfer.contractAddress ?? transfer.to),
      asset: {
        kind: "erc1155",
        chainId: this.chainId,
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

export class NodeRealBscAdapter extends NodeRealEvmAdapter {
  constructor(config: NodeRealBscAdapterConfig) {
    super({
      ...config,
      chainId: 56,
      name: "NodeReal BSC",
      baseUrl: config.baseUrl,
    });
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

function buildTransferEventKey(transfer: NodeRealTransfer): string {
  return `${transfer.hash.toLowerCase()}:${transfer.id}`;
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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function wrapTransportError(error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`NodeReal request failed before a response was received: ${error.message}`);
  }

  return new Error("NodeReal request failed before a response was received.");
}
