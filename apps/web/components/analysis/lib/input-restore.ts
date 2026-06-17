import { evmAggregateChainId } from "../../../app/chains";
import type { AnalysisResponse } from "../types";

export interface AnalysisWorkbenchInputState {
  addresses: string;
  chainId: string;
  dataMode: string;
  dataProvider: string;
  historyScope: string;
  historyDays?: number;
}

export function deriveWorkbenchInputFromResult(
  result: AnalysisResponse,
  evmAggregateChainIds: number[],
): AnalysisWorkbenchInputState {
  if (result.input) {
    return {
      addresses: result.input.addresses.join("\n"),
      chainId: resolveChainSelection(result.input.chainId, result.input.chainIds, evmAggregateChainIds),
      dataMode: result.input.dataMode,
      dataProvider: result.input.dataProvider,
      historyScope: result.input.historyScope ?? "window",
      historyDays: result.input.historyDays,
    };
  }

  const chainIds = result.meta.chainIds?.length ? result.meta.chainIds : [result.meta.chainId];

  return {
    addresses: collectWatchedAddresses(result).join("\n"),
    chainId: resolveChainSelection(result.meta.chainId, chainIds, evmAggregateChainIds),
    dataMode: result.meta.requestedMode,
    dataProvider: result.meta.dataProvider ?? "auto",
    historyScope: result.meta.historyScope ?? "window",
    historyDays: result.meta.historyDays,
  };
}

function resolveChainSelection(
  chainId: number,
  chainIds: number[],
  evmAggregateChainIds: number[],
): string {
  if (chainId === evmAggregateChainId) {
    return String(evmAggregateChainId);
  }

  if (matchesEvmAggregateSelection(chainIds, evmAggregateChainIds)) {
    return String(evmAggregateChainId);
  }

  return String(chainId);
}

function matchesEvmAggregateSelection(chainIds: number[], evmAggregateChainIds: number[]): boolean {
  if (chainIds.length !== evmAggregateChainIds.length) {
    return false;
  }

  const requested = [...chainIds].sort((left, right) => left - right);
  const aggregate = [...evmAggregateChainIds].sort((left, right) => left - right);

  return requested.every((chainId, index) => chainId === aggregate[index]);
}

function collectWatchedAddresses(result: AnalysisResponse): string[] {
  const walletFilters = result.graphView?.walletFilters;
  if (walletFilters?.length) {
    return walletFilters.map((filter) => filter.address);
  }

  const addresses = new Map<string, string>();

  for (const node of result.graph.nodes) {
    if (node.kind !== "wallet" || !node.tags?.includes("watched") || !node.address) {
      continue;
    }

    const key = node.address.toLowerCase();
    if (!addresses.has(key)) {
      addresses.set(key, node.address);
    }
  }

  return Array.from(addresses.values()).sort((left, right) => left.localeCompare(right));
}
