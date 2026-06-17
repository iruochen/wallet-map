import type { Address, ChainId, HistoryScope } from "@wallet-map/core";

export interface AnalyzeRequestInput {
  addresses?: unknown;
  chainId?: unknown;
  chainIds?: unknown;
  dataMode?: unknown;
  dataProvider?: unknown;
  historyScope?: unknown;
  historyDays?: unknown;
}

export type AnalyzeDataMode = "auto" | "fixture" | "live";
export type AnalyzeDataProvider = "auto" | "nodereal" | "etherscan" | "solscan";

export interface ParsedAnalyzeRequest {
  addresses: Address[];
  chainId: ChainId;
  chainIds: ChainId[];
  dataMode: AnalyzeDataMode;
  dataProvider: AnalyzeDataProvider;
  historyScope: HistoryScope;
  historyDays?: number;
}

export function parseAnalyzeRequest(input: AnalyzeRequestInput): ParsedAnalyzeRequest {
  const chainId = parseChainId(input.chainId);
  const chainIds = parseChainIds(input.chainIds, chainId);
  const addresses = parseAddresses(input.addresses, chainIds);
  const historyScope = parseHistoryScope(input.historyScope);

  if (addresses.length < 2) {
    throw new Error("At least two wallet addresses are required.");
  }

  return {
    addresses,
    chainId,
    chainIds,
    dataMode: parseDataMode(input.dataMode),
    dataProvider: parseDataProvider(input.dataProvider),
    historyScope,
    ...(historyScope === "window" ? { historyDays: parseHistoryDays(input.historyDays) } : {}),
  };
}

export function parseAddresses(input: unknown, chainIds: ChainId[] = [1]): Address[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,]+/)
      : [];
  const addresses = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const acceptsSolana = chainIds.some((chainId) => chainId === 101);
  const acceptsEvm = chainIds.some((chainId) => chainId !== 101);
  const invalidAddress = addresses.find((address) => {
    if (acceptsEvm && isEvmAddress(address)) {
      return false;
    }

    if (acceptsSolana && isSolanaAddress(address)) {
      return false;
    }

    return true;
  });

  if (invalidAddress) {
    throw new Error(`Invalid wallet address for selected chain: ${invalidAddress}`);
  }

  return Array.from(
    new Set(addresses.map((address) => (isEvmAddress(address) ? address.toLowerCase() : address) as Address)),
  );
}

function parseChainId(input: unknown): ChainId {
  const chainId = typeof input === "number" ? input : Number(input ?? 1);

  if (!Number.isInteger(chainId) || chainId < 0) {
    throw new Error("A valid chain ID is required.");
  }

  return chainId;
}

function parseChainIds(input: unknown, fallbackChainId: ChainId): ChainId[] {
  const rawValues = Array.isArray(input) ? input : input === undefined ? [fallbackChainId] : [input];
  const chainIds = rawValues.map(parseChainId);

  return Array.from(new Set(chainIds));
}

function parseDataMode(input: unknown): AnalyzeDataMode {
  if (input === undefined || input === null || input === "") {
    return "auto";
  }

  if (input === "auto" || input === "fixture" || input === "live") {
    return input;
  }

  throw new Error("Data mode must be auto, fixture, or live.");
}

function parseDataProvider(input: unknown): AnalyzeDataProvider {
  if (input === undefined || input === null || input === "") {
    return "auto";
  }

  if (input === "auto" || input === "nodereal" || input === "etherscan" || input === "solscan") {
    return input;
  }

  throw new Error("Data provider must be auto, nodereal, etherscan, or solscan.");
}

function parseHistoryScope(input: unknown): HistoryScope {
  if (input === undefined || input === null || input === "") {
    return "window";
  }

  if (input === "window" || input === "full") {
    return input;
  }

  throw new Error('History scope must be "window" or "full".');
}

function parseHistoryDays(input: unknown): number {
  if (input === undefined || input === null || input === "") {
    return 365;
  }

  const days = typeof input === "number" ? input : Number(input);

  if (!Number.isFinite(days)) {
    throw new Error("History days must be a number.");
  }

  return Math.min(1095, Math.max(7, Math.floor(days)));
}

function isEvmAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isSolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
