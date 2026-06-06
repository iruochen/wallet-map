"use client";

import { ArrowDownToLine, GitCompareArrows, ExternalLink, Play, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatAbsoluteTime } from "../../app/format";
import { formatConfidenceLabel } from "../analysis/analysis-formatters";
import { useWalletDisplayName } from "../wallet/use-wallet-display-name";
import {
  buildHistoryComparison,
  toggleHistoryComparisonSelection,
} from "./history-comparison";
import { HistoryDeleteDialog } from "./history-delete-dialog";
import { HistoryIdentityAvatar } from "./history-identity-avatar";
import type { HistoryJobItem, HistoryResponse } from "./history-types";

const activeAnalysisJobStorageKey = "wallet-map:active-analysis-job";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [pendingDeleteJob, setPendingDeleteJob] = useState<HistoryJobItem | null>(null);
  const [comparisonJobIds, setComparisonJobIds] = useState<string[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isTableScrolling, setIsTableScrolling] = useState(false);
  const tableScrollTimerRef = useRef<number | null>(null);
  const comparison = useMemo(
    () => buildHistoryComparison(jobs, comparisonJobIds),
    [jobs, comparisonJobIds],
  );

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

  async function loadJobs(options: { showSkeleton?: boolean; showListLoading?: boolean } = {}) {
    if (options.showListLoading) {
      setIsListLoading(true);
    } else if (!options.showSkeleton) {
      setIsRefreshing(true);
    }
    setLoadError(null);

    try {
      const response = await fetch("/api/analyze/jobs?limit=30");
      const body = (await response.json()) as HistoryResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load history.");
      }

      setJobs(body.jobs ?? []);
      setComparisonJobIds((current) => current.filter((id) => body.jobs?.some((job) => job.id === id) ?? false));
      setStorageEnabled(body.storageEnabled !== false);
      setHistoryMode(body.historyMode ?? "session");
      setWalletAddress(body.walletAddress);
      setAnonymousSessionId(body.anonymousSessionId);
      setSessionSyncCount(body.sessionSyncCount ?? 0);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Failed to load history.");
    } finally {
      setHasLoaded(true);
      setIsRefreshing(false);
      setIsListLoading(false);
    }
  }

  async function syncSessionHistory() {
    setIsSyncing(true);
    setSyncMessage(null);
    setLoadError(null);

    try {
      const response = await fetch("/api/analyze/jobs/sync-session", { method: "POST" });
      const body = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to sync session history.");
      }

      setSyncMessage(body.message ?? "会话记录已同步。");
      await loadJobs();
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Failed to sync session history.");
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

  async function confirmDeleteJob() {
    if (!pendingDeleteJob) {
      return;
    }

    const jobId = pendingDeleteJob.id;
    setDeletingJobId(jobId);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/analyze/jobs/${jobId}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to delete history record.");
      }

      setPendingDeleteJob(null);
      await loadJobs({ showListLoading: true });
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Failed to delete history record.");
    } finally {
      setDeletingJobId(null);
    }
  }

  function renderListBody(content: ReactNode) {
    return (
      <>
        <div className="historyListBody">
          {header}
          <div
            className={`historyTableScroll ${isTableScrolling ? "historyTableScrolling" : ""}`}
            onScroll={handleTableScroll}
          >
            {content}
          </div>
        </div>
        {pendingDeleteJob ? (
          <HistoryDeleteDialog
            job={pendingDeleteJob}
            isDeleting={deletingJobId === pendingDeleteJob.id}
            onCancel={() => {
              if (deletingJobId) {
                return;
              }
              setPendingDeleteJob(null);
              setDeleteError(null);
            }}
            deleteError={deleteError}
            onConfirm={() => void confirmDeleteJob()}
          />
        ) : null}
      </>
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

  if (loadError) {
    const needsMigration = loadError.includes('column "chain_name" does not exist');

    return renderListBody(
      <div className="historyEmpty historyEmptyError">
        <strong>加载失败</strong>
        <p>{loadError}</p>
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
          className="historyEmptyAction"
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
    <div className={`historyTableWrap ${isListLoading ? "historyTableWrapLoading" : ""}`}>
      {isListLoading ? (
        <div className="historyTableLoadingOverlay" role="status" aria-live="polite">
          <RefreshCw className="historySpinIcon" size={18} aria-hidden="true" />
          <span>正在刷新历史记录…</span>
        </div>
      ) : null}
      <table className="historyTable">
        <thead>
          <tr>
            <th>时间</th>
            <th>范围</th>
            <th>地址 / 事件</th>
            <th>评分</th>
            <th>状态</th>
            <th>操作</th>
            <th>对比</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className={comparisonJobIds.includes(job.id) ? "historyRowSelected" : undefined}>
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
                <div className="historyRowActions">
                  {job.status === "completed" ? (
                    <Link className="secondaryButton historyOpenButton" href={`/?job=${job.id}`}>
                      <ExternalLink size={14} aria-hidden="true" />
                      打开
                    </Link>
                  ) : null}
                  {historyMode === "wallet" ? (
                    <button
                      className="historyDeleteButton"
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDeleteJob(job);
                      }}
                      disabled={Boolean(deletingJobId) || isRefreshing || isSyncing || isListLoading}
                      title="删除这条历史记录"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      删除
                    </button>
                  ) : null}
                </div>
              </td>
              <td>
                <button
                  type="button"
                  className={`historyCompareButton ${comparisonJobIds.includes(job.id) ? "historyCompareButtonActive" : ""}`}
                  disabled={job.status !== "completed"}
                  onClick={() => setComparisonJobIds((current) => toggleHistoryComparisonSelection(current, job))}
                  title={job.status === "completed" ? "加入历史对比" : "只有已完成的任务可以对比"}
                >
                  <GitCompareArrows size={14} aria-hidden="true" />
                  {comparisonJobIds.includes(job.id) ? "已选" : "选择"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <HistoryComparisonPanel
        comparison={comparison}
        selectedCount={comparisonJobIds.length}
        onClear={() => setComparisonJobIds([])}
      />
    </div>,
  );
}

function HistoryComparisonPanel({
  comparison,
  selectedCount,
  onClear,
}: {
  comparison: ReturnType<typeof buildHistoryComparison>;
  selectedCount: number;
  onClear: () => void;
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <aside className="historyComparePanel" aria-label="历史任务对比">
      <div className="historyCompareHeader">
        <div>
          <strong>历史任务对比</strong>
          <span>{comparison ? "按完成时间从早到晚展示差异" : `已选择 ${selectedCount} / 2 个已完成任务`}</span>
        </div>
        <button type="button" className="historyCompareClear" onClick={onClear}>
          清空
        </button>
      </div>
      {comparison ? (
        <>
          <div className="historyCompareJobs">
            <div>
              <span>Baseline</span>
              <strong>{formatAbsoluteTime(comparison.first.completedAt ?? comparison.first.createdAt) ?? comparison.first.id}</strong>
            </div>
            <div>
              <span>Compare</span>
              <strong>{formatAbsoluteTime(comparison.second.completedAt ?? comparison.second.createdAt) ?? comparison.second.id}</strong>
            </div>
          </div>
          <div className="historyCompareMetrics">
            {comparison.metrics.map((metric) => (
              <div key={metric.label} className="historyCompareMetric">
                <span>{metric.label}</span>
                <strong>{metric.first}</strong>
                <strong>{metric.second}</strong>
                <em>{metric.delta ?? "—"}</em>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="historyCompareHint">再选择一个已完成任务即可查看分数、事件量和来源变化。</p>
      )}
    </aside>
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
