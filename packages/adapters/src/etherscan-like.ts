import type { Address, ChainId, NormalizedEvent, TxHash } from "@wallet-map/core";
import type { AdapterFetchResult, AdapterRequest, ChainAdapter } from "./index";
import {
  buildMaxEventsReason,
  capEvents,
  finalizeFetchCoverage,
  mergeFetchCoverage,
  resolveAdapterFetchPlan,
} from "./fetch-helpers";

export interface EtherscanLikeAdapterConfig {
  baseUrl: string;
  apiKey?: string;
  chainId: ChainId;
  name: string;
  useChainIdParam?: boolean;
  requestThrottleMs?: number;
  maxRateLimitRetries?: number;
  pageOffset?: number;
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
type EtherscanTx = EtherscanNativeTx | EtherscanInternalTx | EtherscanTokenTx | EtherscanNftTx;

export class EtherscanLikeAdapter implements ChainAdapter {
  readonly id: string;
  readonly name: string;
  readonly chainId: ChainId;

  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly useChainIdParam: boolean;
  private readonly requestThrottleMs: number;
  private readonly maxRateLimitRetries: number;
  private readonly pageOffset: number;
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
    this.pageOffset = Math.max(1, Math.min(config.pageOffset ?? 1000, 1000));
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  async getEvents(request: AdapterRequest): Promise<AdapterFetchResult> {
    const plan = resolveAdapterFetchPlan(request.fetchPlan);
    const sort = plan.scope === "window" ? "desc" : "asc";
    const remainingBudget = () => Math.max(0, plan.maxEventsPerAddress - events.length);
    const events: NormalizedEvent[] = [];
    let coverage = finalizeFetchCoverage(events, { truncated: false });

    const appendAction = async <T extends EtherscanTx>(
      action: EtherscanAction,
      mapper: (tx: T) => NormalizedEvent | NormalizedEvent[] | null,
      filter?: (tx: T) => boolean,
    ) => {
      if (remainingBudget() === 0) {
        coverage = mergeFetchCoverage(coverage, {
          fetched: 0,
          truncated: true,
          reason: buildMaxEventsReason(plan.maxEventsPerAddress),
        });
        return;
      }

      const pageResult = await this.fetchAccountActionPages<T>(request, action, {
        sort,
        maxEvents: remainingBudget(),
        fromTimestamp: plan.scope === "window" ? plan.fromTimestamp : undefined,
      });

      for (const tx of pageResult.records) {
        if (filter && !filter(tx)) {
          continue;
        }

        const mapped = mapper(tx);
        if (!mapped) {
          continue;
        }

        if (Array.isArray(mapped)) {
          events.push(...mapped);
        } else {
          events.push(mapped);
        }
      }

      coverage = mergeFetchCoverage(coverage, pageResult.coverage);
    };

    await appendAction<EtherscanNativeTx>(
      "txlist",
      (tx) => {
        if (isNativeTransferTx(tx)) {
          return this.mapNativeTransfer(tx);
        }

        if (isContractCallTx(tx)) {
          return this.mapContractCall(tx);
        }

        return null;
      },
      (tx) => isSuccessfulNativeTx(tx),
    );
    await appendAction<EtherscanInternalTx>(
      "txlistinternal",
      (tx) => this.mapInternalTransfer(tx),
      (tx) => isSuccessfulInternalTx(tx),
    );
    await appendAction<EtherscanTokenTx>("tokentx", (tx) => this.mapTokenTransfer(tx));
    await appendAction<EtherscanNftTx>("tokennfttx", (tx) => this.mapNftTransfer(tx));

    const capped = capEvents(events, plan.maxEventsPerAddress);
    const sorted = capped.events.sort((left, right) => {
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber - right.blockNumber;
      }

      return left.id.localeCompare(right.id);
    });

    return {
      events: sorted,
      coverage: finalizeFetchCoverage(sorted, {
        truncated: coverage.truncated || capped.truncated,
        reason: coverage.reason ?? (capped.truncated ? buildMaxEventsReason(plan.maxEventsPerAddress) : undefined),
      }),
    };
  }

  private async fetchAccountActionPages<T extends EtherscanTx>(
    request: AdapterRequest,
    action: EtherscanAction,
    input: {
      sort: "asc" | "desc";
      maxEvents: number;
      fromTimestamp?: number;
    },
  ): Promise<{ records: T[]; coverage: AdapterFetchResult["coverage"] }> {
    const records: T[] = [];
    let page = 1;
    let truncated = false;
    let reason: string | undefined;

    while (records.length < input.maxEvents) {
      const pageRecords = await this.fetchAccountActionPage<T>(request, action, page, input.sort);

      if (pageRecords.length === 0) {
        break;
      }

      if (input.fromTimestamp !== undefined) {
        const inWindow = pageRecords.filter((tx) => Number(tx.timeStamp) >= input.fromTimestamp!);
        records.push(...inWindow);

        const oldestInPage = Math.min(...pageRecords.map((tx) => Number(tx.timeStamp)));
        if (oldestInPage < input.fromTimestamp) {
          break;
        }
      } else {
        records.push(...pageRecords);
      }

      if (pageRecords.length < this.pageOffset) {
        break;
      }

      if (records.length >= input.maxEvents) {
        truncated = true;
        reason = buildMaxEventsReason(input.maxEvents);
        break;
      }

      page += 1;
    }

    return {
      records: records.slice(0, input.maxEvents),
      coverage: {
        fetched: records.length,
        truncated,
        ...(reason ? { reason } : {}),
      },
    };
  }

  private async fetchAccountActionPage<T>(
    request: AdapterRequest,
    action: EtherscanAction,
    page: number,
    sort: "asc" | "desc",
  ): Promise<T[]> {
    if (this.requestThrottleMs > 0) {
      await sleep(this.requestThrottleMs);
    }

    let attempt = 0;

    while (true) {
      const url = this.buildAccountUrl(request, action, page, sort);
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
        return payload.result as T[];
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

      return payload.result as T[];
    }
  }

  private buildAccountUrl(
    request: AdapterRequest,
    action: EtherscanAction,
    page: number,
    sort: "asc" | "desc",
  ): URL {
    const url = new URL(this.baseUrl);
    if (this.useChainIdParam) {
      url.searchParams.set("chainid", String(this.chainId));
    }
    url.searchParams.set("module", "account");
    url.searchParams.set("action", action);
    url.searchParams.set("address", request.address);
    url.searchParams.set("sort", sort);
    url.searchParams.set("page", String(page));
    url.searchParams.set("offset", String(this.pageOffset));

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
