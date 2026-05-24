import type { Address, ChainId } from "@wallet-map/core";

export interface AnalyzeRequestInput {
  addresses?: unknown;
  chainId?: unknown;
  dataMode?: unknown;
}

export type AnalyzeDataMode = "auto" | "fixture" | "live";

export interface ParsedAnalyzeRequest {
  addresses: Address[];
  chainId: ChainId;
  dataMode: AnalyzeDataMode;
}

export function parseAnalyzeRequest(input: AnalyzeRequestInput): ParsedAnalyzeRequest {
  const chainId = parseChainId(input.chainId);
  const addresses = parseAddresses(input.addresses);

  if (addresses.length < 2) {
    throw new Error("At least two wallet addresses are required.");
  }

  return {
    addresses,
    chainId,
    dataMode: parseDataMode(input.dataMode),
  };
}

export function parseAddresses(input: unknown): Address[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\s,]+/)
      : [];
  const addresses = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const invalidAddress = addresses.find((address) => !isEvmAddress(address));

  if (invalidAddress) {
    throw new Error(`Invalid EVM address: ${invalidAddress}`);
  }

  return Array.from(new Set(addresses.map((address) => address.toLowerCase() as Address)));
}

function parseChainId(input: unknown): ChainId {
  const chainId = typeof input === "number" ? input : Number(input ?? 1);

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("A valid chain ID is required.");
  }

  return chainId;
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

function isEvmAddress(value: string): value is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
