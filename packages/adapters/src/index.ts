import type { Address, BlockRange, ChainId, NormalizedEvent } from "@wallet-map/core";

export interface AdapterRequest {
  address: Address;
  range?: BlockRange;
}

export interface ChainAdapter {
  id: string;
  name: string;
  chainId: ChainId;
  getEvents(request: AdapterRequest): Promise<NormalizedEvent[]>;
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

  async getEvents(request: AdapterRequest): Promise<NormalizedEvent[]> {
    const target = request.address.toLowerCase();

    return this.events.filter((event) => {
      return event.from?.toLowerCase() === target || event.to?.toLowerCase() === target;
    });
  }
}
