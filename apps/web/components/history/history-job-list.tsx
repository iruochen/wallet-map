"use client";

import { ArrowDownToLine, ExternalLink, Play, RefreshCw, ScrollText } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatAbsoluteTime } from "../../app/format";
import { formatConfidenceLabel } from "../analysis/analysis-formatters";
import { useWalletDisplayName } from "../wallet/use-wallet-display-name";
import { HistoryIdentityAvatar } from "./history-identity-avatar";

const activeAnalysisJobStorageKey = "wallet-map:active-analysis-job";

interface HistoryJobItem {
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
  completedAt?: string;
  errorMessage?: string;
}

interface HistoryResponse {
  jobs?: HistoryJobItem[];
  storageEnabled?: boolean;
  historyMode?: "wallet" | "session";
  walletAddress?: string;
  anonymousSessionId?: string;
  sessionSyncCount?: number;
  error?: string;
}

export function HistoryJobList({
  initialHistoryMode = "session",
  initialWalletAddress,
}: {
  initialHistoryMode?: "wallet" | "session";
  initialWalletAddress?: string;
}) {
  const [jobs, setJobs] = useState<HistoryJobItem[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [historyMode, setHistoryMode] = useState<"wallet" | "session">(initialHistoryMode);
  const [walletAddress, setWalletAddress] = useState<string | undefined>(initialWalletAddress);
  const [anonymousSessionId, setAnonymousSessionId] = useState<string | undefined>();
  const [sessionSyncCount, setSessionSyncCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTableScrolling, setIsTableScrolling] = useState(false);
  const tableScrollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    void loadJobs({ showSkeleton: true });
  }, []);

  useEffect(() => {
    function handleAuthChanged() {
      void loadJobs();
    }

    window.addEventListener("wallet-map-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("wallet-map-auth-changed", handleAuthChanged);
  }, []);

  useEffect(() => {
    return () => {
      if (tableScrollTimerRef.current) {
        window.clearTimeout(tableScrollTimerRef.current);
      }
    };
  }, []);

  async function loadJobs(options: { showSkeleton?: boolean } = {}) {
    if (!options.showSkeleton) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/analyze/jobs?limit=30");
      const body = (await response.json()) as HistoryResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load history.");
      }

      setJobs(body.jobs ?? []);
      setStorageEnabled(body.storageEnabled !== false);
      setHistoryMode(body.historyMode ?? "session");
      setWalletAddress(body.walletAddress);
      setAnonymousSessionId(body.anonymousSessionId);
      setSessionSyncCount(body.sessionSyncCount ?? 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load history.");
    } finally {
      setHasLoaded(true);
      setIsRefreshing(false);
    }
  }

  async function syncSessionHistory() {
    setIsSyncing(true);
    setSyncMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/analyze/jobs/sync-session", { method: "POST" });
      const body = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to sync session history.");
      }

      setSyncMessage(body.message ?? "会话记录已同步。");
      await loadJobs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to sync session history.");
    } finally {
      setIsSyncing(false);
    }
  }

  function handleTableScroll() {
    setIsTableScrolling(true);

    if (tableScrollTimerRef.current) {
      window.clearTimeout(tableScrollTimerRef.current);
    }

    tableScrollTimerRef.current = window.setTimeout(() => {
      setIsTableScrolling(false);
    }, 700);
  }

  function renderListBody(content: ReactNode) {
    return (
      <div className="historyListBody">
        {header}
        <div
          className={`historyTableScroll ${isTableScrolling ? "historyTableScrolling" : ""}`}
          onScroll={handleTableScroll}
        >
          {content}
        </div>
      </div>
    );
  }

  const avatarSeed =
    historyMode === "wallet" && walletAddress
      ? walletAddress
      : anonymousSessionId ?? "wallet-map-session";
  const { displayName: walletDisplayName, ensName: walletEnsName, addressLabel: walletAddressLabel } =
    useWalletDisplayName(historyMode === "wallet" ? walletAddress : undefined);

  const header = (
    <>
      <div className="historyToolbar">
        <div className="historyIdentity">
          <HistoryIdentityAvatar
            variant={historyMode === "wallet" ? "wallet" : "session"}
            seed={avatarSeed}
          />
          <div>
            <strong>{historyMode === "wallet" ? "钱包历史" : "当前会话历史"}</strong>
            {historyMode === "wallet" && walletAddress ? (
              <>
                <span title={walletEnsName ? walletAddress : undefined}>{walletDisplayName}</span>
                {walletEnsName && walletAddressLabel ? (
                  <small className="historyIdentityAddress">{walletAddressLabel}</small>
                ) : null}
              </>
            ) : (
              <span>登录后可跨会话查看历史</span>
            )}
          </div>
        </div>
        <div className="historyToolbarActions">
          {historyMode === "wallet" && sessionSyncCount > 0 ? (
            <button
              className="historySyncButton"
              type="button"
              onClick={() => void syncSessionHistory()}
              disabled={isSyncing || isRefreshing}
              title="将未登录时保存在当前浏览器的分析记录同步到钱包"
            >
              <ArrowDownToLine className={isSyncing ? "historySpinIcon" : ""} size={15} aria-hidden="true" />
              同步会话记录 ({sessionSyncCount})
            </button>
          ) : null}
          <button className="historyIconButton" type="button" onClick={() => void loadJobs()} disabled={isRefreshing || isSyncing} title="刷新历史">
            <RefreshCw className={isRefreshing ? "historySpinIcon" : ""} size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      {syncMessage ? (
        <div className="stateBanner stateBannerSuccess historySyncBanner" role="status">
          <strong>同步完成</strong>
          <span>{syncMessage}</span>
        </div>
      ) : null}
    </>
  );

  if (!hasLoaded) {
    return renderListBody(<HistorySkeleton />);
  }

  if (!storageEnabled) {
    return renderListBody(
      <div className="historyEmpty">
        <strong>数据库未配置</strong>
        <p>在 Vercel 或本地配置 `DATABASE_URL` 并执行 migration 后，分析结果会自动保存到这里。</p>
      </div>,
    );
  }

  if (error) {
    const needsMigration = error.includes('column "chain_name" does not exist');

    return renderListBody(
      <div className="historyEmpty historyEmptyError">
        <strong>加载失败</strong>
        <p>{error}</p>
        {needsMigration ? (
          <p>
            数据库缺少 M2 migration。重启服务后会自动补齐；若仍失败，请手动执行
            {" "}
            <code>packages/storage/migrations/0002_analysis_job_metadata.sql</code>。
          </p>
        ) : null}
      </div>,
    );
  }

  if (jobs.length === 0) {
    return renderListBody(
      <div className="historyEmpty">
        <div className="historyEmptyIcon" aria-hidden="true">
          <ScrollText size={24} strokeWidth={1.6} />
        </div>
        <strong className="historyEmptyTitle">还没有历史记录</strong>
        <p className="historyEmptyDescription">
          {historyMode === "wallet"
            ? "这个钱包还没有保存过分析记录。完成一次分析后，结果会自动同步到这里。"
            : "完成一次分析后，任务会显示在这里。登录钱包后还能跨会话查看。"}
        </p>
        <Link
          className="primaryButton primaryButtonCompact historyEmptyAction"
          href="/?fresh=1"
          onClick={clearStoredAnalysisJob}
        >
          <Play size={15} aria-hidden="true" />
          去运行分析
        </Link>
      </div>,
    );
  }

  return renderListBody(
    <div className="historyTableWrap">
      <table className="historyTable">
        <thead>
          <tr>
            <th>时间</th>
            <th>范围</th>
            <th>地址 / 事件</th>
            <th>评分</th>
            <th>状态</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>
                <strong>{formatAbsoluteTime(job.completedAt ?? job.createdAt) ?? job.createdAt}</strong>
                <small>{job.dataMode ?? "auto"}</small>
              </td>
              <td>
                <strong>{job.chainName ?? "Unknown chain"}</strong>
                <small>{job.sourceLabel ?? "—"}</small>
              </td>
              <td>
                {job.watchedAddressCount ?? "—"} 地址 · {job.eventCount ?? "—"} 事件
              </td>
              <td>
                {job.score ? (
                  <>
                    <strong>{job.score.score}/100</strong>
                    <small>
                      {formatConfidenceLabel(job.score.confidence as "low" | "medium" | "high")}
                    </small>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <span className={`historyStatus historyStatus-${job.status}`}>{job.status}</span>
                {job.errorMessage ? <small>{job.errorMessage}</small> : null}
              </td>
              <td>
                {job.status === "completed" ? (
                  <Link className="secondaryButton historyOpenButton" href={`/?job=${job.id}`}>
                    <ExternalLink size={14} aria-hidden="true" />
                    打开
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
  );
}

function HistorySkeleton() {
  return (
    <div className="historyTableWrap historySkeleton" aria-label="正在加载历史记录">
      {Array.from({ length: 5 }, (_, index) => (
        <div className="historySkeletonRow" key={index}>
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function clearStoredAnalysisJob() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(activeAnalysisJobStorageKey);
  } catch {
    // Ignore blocked storage.
  }
}
