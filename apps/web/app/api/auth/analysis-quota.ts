export interface AnonymousAnalysisQuota {
  limit: number;
  used: number;
  remaining: number;
}

export function readAnonymousAnalysisLimit(): number | null {
  const raw = process.env.WALLET_MAP_ANON_ANALYSIS_LIMIT?.trim();

  if (!raw || raw === "0" || raw.toLowerCase() === "unlimited" || raw.toLowerCase() === "none") {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

export function buildAnonymousQuota(used: number, limit: number | null): AnonymousAnalysisQuota | null {
  if (limit === null) {
    return null;
  }

  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

export function formatAnonymousQuotaError(limit: number): string {
  return `未登录用户最多可创建 ${limit} 次分析，请连接钱包登录后继续。`;
}
