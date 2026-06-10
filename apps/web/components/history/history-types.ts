export interface HistoryJobItem {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  chainName?: string;
  sourceLabel?: string;
  dataMode?: string;
  watchedAddressCount?: number;
  eventCount?: number;
  score?: {
    score: number;
    confidence: string;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface HistoryResponse {
  jobs?: HistoryJobItem[];
  total?: number;
  limit?: number;
  offset?: number;
  storageEnabled?: boolean;
  historyMode?: "wallet" | "session";
  walletAddress?: string;
  anonymousSessionId?: string;
  sessionSyncCount?: number;
  error?: string;
}
