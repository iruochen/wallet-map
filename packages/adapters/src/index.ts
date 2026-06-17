import type { Address, BlockRange, ChainId, FetchPlan, NormalizedEvent } from "@wallet-map/core";
import type { AdapterFetchResult } from "./fetch-helpers";

export interface AdapterRequest {
  address: Address;
  range?: BlockRange;
  fetchPlan?: FetchPlan;
}

export interface ChainAdapter {
  id: string;
  name: string;
  chainId: ChainId;
  getEvents(request: AdapterRequest): Promise<AdapterFetchResult>;
}

export interface AdapterRegistry {
  register(adapter: ChainAdapter): void;
  get(chainId: ChainId): ChainAdapter | undefined;
  list(): ChainAdapter[];
}

export function createAdapterRegistry(): AdapterRegistry {
  const adapters = new Map<ChainId, ChainAdapter>();

  return {
    register(adapter) {
      adapters.set(adapter.chainId, adapter);
    },
    get(chainId) {
      return adapters.get(chainId);
    },
    list() {
      return Array.from(adapters.values());
    },
  };
}

export class CsvImportAdapter implements ChainAdapter {
  id = "csv-import";
  name = "CSV Import";

  constructor(
    public chainId: ChainId,
    private readonly events: NormalizedEvent[] = [],
  ) {}

  async getEvents(request: AdapterRequest): Promise<AdapterFetchResult> {
    const target = request.address.toLowerCase();

    const events = this.events.filter((event) => {
      return event.from?.toLowerCase() === target || event.to?.toLowerCase() === target;
    });

    return {
      events,
      coverage: {
        fetched: events.length,
        truncated: false,
      },
    };
  }
}

export type { AdapterFetchResult } from "./fetch-helpers";
export {
  buildMaxEventsReason,
  buildWindowDaysReason,
  defaultHistoryDays,
  defaultMaxEventsPerAddress,
  resolveAnalyzeFetchPlan,
} from "./fetch-helpers";
export type { ResolveAnalyzeFetchPlanInput } from "./fetch-helpers";

export { EtherscanLikeAdapter } from "./etherscan-like";
export type { EtherscanLikeAdapterConfig } from "./etherscan-like";
export { NodeRealBscAdapter, NodeRealEvmAdapter } from "./nodereal-bsc";
export type { NodeRealBscAdapterConfig } from "./nodereal-bsc";
export { SolscanAdapter } from "./solscan";
export type { SolscanAdapterConfig } from "./solscan";
