"use client";

import { ArrowDownToLine, GitCompareArrows, ExternalLink, Play, RefreshCw, ScrollText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatAbsoluteTime } from "../../app/format";
import { formatConfidenceLabel } from "../analysis/analysis-formatters";
import { useI18n, type I18nKey } from "../i18n/i18n-provider";
import { useWalletDisplayName } from "../wallet/use-wallet-display-name";
import {
  buildHistoryComparison,
  toggleHistoryComparisonSelection,
} from "./history-comparison";
import { HistoryDeleteDialog } from "./history-delete-dialog";
import { HistoryIdentityAvatar } from "./history-identity-avatar";
import { readSessionHistoryJobs } from "./session-history";
import type { HistoryJobItem, HistoryResponse } from "./history-types";

const activeAnalysisJobStorageKey = "wallet-map:active-analysis-job";
const historyPageSizeOptions = [10, 20, 50] as const;
type HistoryStatusFilter = "all" | HistoryJobItem["status"];

export function HistoryJobList({
  initialHistoryMode = "session",
  initialWalletAddress,
}: {
  initialHistoryMode?: "wallet" | "session";
  initialWalletAddress?: string;
}) {
  const { t } = useI18n();
  const [jobs, setJobs] = useState<HistoryJobItem[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [historyMode, setHistoryMode] = useState<"wallet" | "session">(initialHistoryMode);
  const [walletAddress, setWalletAddress] = useState<string | undefined>(initialWalletAddress);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [historyQuery, setHistoryQuery] = useState("");
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const hasHistoryFilters = statusFilter !== "all" || Boolean(historyQuery.trim());

  useEffect(() => {
    void loadJobs({ showSkeleton: true });
  }, [page, pageSize, statusFilter, historyQuery]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      });

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (historyQuery.trim()) {
        params.set("query", historyQuery.trim());
      }

      const response = await fetch(`/api/analyze/jobs?${params.toString()}`);
      const body = (await response.json()) as HistoryResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load history.");
      }

      const nextStorageEnabled = body.storageEnabled !== false;
      const sessionHistory = nextStorageEnabled
        ? undefined
        : getFilteredSessionHistoryJobs({
            statusFilter,
            query: historyQuery,
            offset: (page - 1) * pageSize,
            limit: pageSize,
          });
      const nextJobs = nextStorageEnabled ? (body.jobs ?? []) : sessionHistory?.jobs ?? [];
      const nextTotal = nextStorageEnabled ? (body.total ?? body.jobs?.length ?? 0) : sessionHistory?.total ?? 0;

      setJobs(nextJobs);
      setTotal(nextTotal);
      setComparisonJobIds((current) => current.filter((id) => nextJobs.some((job) => job.id === id)));
      setStorageEnabled(nextStorageEnabled);
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

      setSyncMessage(body.message ?? t("history.sync.defaultMessage"));
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
            <strong>{historyMode === "wallet" ? t("history.title.wallet") : t("history.title.session")}</strong>
            {historyMode === "wallet" && walletAddress ? (
              <>
                <span title={walletEnsName ? walletAddress : undefined}>{walletDisplayName}</span>
                {walletEnsName && walletAddressLabel ? (
                  <small className="historyIdentityAddress">{walletAddressLabel}</small>
                ) : null}
              </>
            ) : (
              <span>{t("history.subtitle.signIn")}</span>
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
              title={t("history.sync.buttonTitle")}
            >
              <ArrowDownToLine className={isSyncing ? "historySpinIcon" : ""} size={15} aria-hidden="true" />
              {t("history.sync.button", { count: sessionSyncCount })}
            </button>
          ) : null}
          {!storageEnabled ? (
            <span className="historyLocalBadge" title={t("history.localBadge.title")}>
              {t("history.localBadge")}
            </span>
          ) : null}
          <button className="historyIconButton" type="button" onClick={() => void loadJobs()} disabled={isRefreshing || isSyncing} title={t("history.refresh.title")}>
            <RefreshCw className={isRefreshing ? "historySpinIcon" : ""} size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="historyFilterBar" aria-label={t("history.filter.aria")}>
        <label className="historyFilterField">
          <span>{t("history.filter.status")}</span>
          <select
            value={statusFilter}
            disabled={isRefreshing || isListLoading}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as HistoryStatusFilter);
            }}
          >
            <option value="all">{t("history.filter.status.all")}</option>
            <option value="completed">{t("history.filter.status.completed")}</option>
            <option value="running">{t("history.filter.status.running")}</option>
            <option value="pending">{t("history.filter.status.pending")}</option>
            <option value="failed">{t("history.filter.status.failed")}</option>
          </select>
        </label>
        <label className="historyFilterField historyFilterSearch">
          <span>{t("history.filter.search")}</span>
          <input
            value={historyQuery}
            disabled={isRefreshing || isListLoading}
            onChange={(event) => {
              setPage(1);
              setHistoryQuery(event.target.value);
            }}
            placeholder={t("history.filter.search.placeholder")}
          />
        </label>
        <label className="historyFilterField historyPageSizeControl">
          <span>{t("history.filter.pageSize")}</span>
          <select
            value={pageSize}
            disabled={isRefreshing || isListLoading}
            onChange={(event) => {
              setPage(1);
              setPageSize(Number(event.target.value));
            }}
          >
            {historyPageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="historyResultBar">
        <span>
          {total === 0
            ? t("history.result.empty")
            : t("history.result.range", { start: rangeStart, end: rangeEnd, total })}
        </span>
        <HistoryPagination
          page={page}
          totalPages={totalPages}
          disabled={isRefreshing || isListLoading}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          t={t}
        />
      </div>
      {syncMessage ? (
        <div className="stateBanner stateBannerSuccess historySyncBanner" role="status">
          <strong>{t("history.sync.success")}</strong>
          <span>{syncMessage}</span>
        </div>
      ) : null}
    </>
  );

  if (!hasLoaded) {
    return renderListBody(<HistorySkeleton t={t} />);
  }

  if (loadError) {
    const needsMigration = loadError.includes('column "chain_name" does not exist');

    return renderListBody(
      <div className="historyEmpty historyEmptyError">
        <strong>{t("history.error.loadFailed")}</strong>
        <p>{loadError}</p>
        {needsMigration ? <p>{t("history.error.migration")}</p> : null}
      </div>,
    );
  }

  if (jobs.length === 0) {
    return renderListBody(
      <div className="historyEmpty">
        <div className="historyEmptyIcon" aria-hidden="true">
          <ScrollText size={24} strokeWidth={1.6} />
        </div>
        <strong className="historyEmptyTitle">
          {hasHistoryFilters ? t("history.empty.filtered.title") : t("history.empty.default.title")}
        </strong>
        <p className="historyEmptyDescription">
          {hasHistoryFilters
            ? t("history.empty.filtered.body")
            : historyMode === "wallet"
            ? t("history.empty.wallet.body")
            : storageEnabled
              ? t("history.empty.session.body")
              : t("history.empty.local.body")}
        </p>
        {hasHistoryFilters ? null : (
          <Link
            className="historyEmptyAction"
            href="/?fresh=1"
            onClick={clearStoredAnalysisJob}
          >
            <Play size={15} aria-hidden="true" />
            {t("history.empty.action")}
          </Link>
        )}
      </div>,
    );
  }

  return renderListBody(
    <div className={`historyTableWrap ${isListLoading ? "historyTableWrapLoading" : ""}`}>
      {isListLoading ? (
        <div className="historyTableLoadingOverlay" role="status" aria-live="polite">
          <RefreshCw className="historySpinIcon" size={18} aria-hidden="true" />
          <span>{t("history.loading.refresh")}</span>
        </div>
      ) : null}
      <table className="historyTable">
        <thead>
          <tr>
            <th>{t("history.table.time")}</th>
            <th>{t("history.table.scope")}</th>
            <th>{t("history.table.addressEvents")}</th>
            <th>{t("history.table.score")}</th>
            <th>{t("history.table.status")}</th>
            <th>{t("history.table.actions")}</th>
            <th>{t("history.table.compare")}</th>
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
                {t("history.row.stats", {
                  addresses: job.watchedAddressCount ?? "—",
                  events: job.eventCount ?? "—",
                })}
              </td>
              <td>
                {job.score ? (
                  <>
                    <strong>{job.score.score}/100</strong>
                    <small>
                      {formatConfidenceLabel(t, job.score.confidence as "low" | "medium" | "high")}
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
                      {t("history.row.open")}
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
                      title={t("history.row.delete.title")}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      {t("history.row.delete")}
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
                  title={
                    job.status === "completed"
                      ? t("history.row.compare.add")
                      : t("history.row.compare.disabled")
                  }
                >
                  <GitCompareArrows size={14} aria-hidden="true" />
                  {comparisonJobIds.includes(job.id) ? t("history.row.compare.selected") : t("history.row.compare.select")}
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
        t={t}
      />
    </div>,
  );
}

function HistoryPagination({
  page,
  totalPages,
  disabled,
  onPrevious,
  onNext,
  t,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="historyPagination">
      <button
        type="button"
        className="historyPaginationButton"
        disabled={disabled || page <= 1}
        onClick={onPrevious}
        aria-label={t("history.pagination.previous")}
      >
        ‹
      </button>
      <span>{t("history.pagination.page", { page, totalPages })}</span>
      <button
        type="button"
        className="historyPaginationButton"
        disabled={disabled || page >= totalPages}
        onClick={onNext}
        aria-label={t("history.pagination.next")}
      >
        ›
      </button>
    </div>
  );
}

function HistoryComparisonPanel({
  comparison,
  selectedCount,
  onClear,
  t,
}: {
  comparison: ReturnType<typeof buildHistoryComparison>;
  selectedCount: number;
  onClear: () => void;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <aside className="historyComparePanel" aria-label={t("history.compare.aria")}>
      <div className="historyCompareHeader">
        <div>
          <strong>{t("history.compare.title")}</strong>
          <span>
            {comparison
              ? t("history.compare.summary.diff")
              : t("history.compare.summary.selected", { count: selectedCount })}
          </span>
        </div>
        <button type="button" className="historyCompareClear" onClick={onClear}>
          {t("history.compare.clear")}
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
        <p className="historyCompareHint">{t("history.compare.hint")}</p>
      )}
    </aside>
  );
}

function HistorySkeleton({
  t,
}: {
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="historyTableWrap historySkeleton" aria-label={t("history.loading.skeleton")}>
      <div className="historySkeletonHeader" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="historySkeletonBody" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <div className="historySkeletonRow" key={index}>
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
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

function getFilteredSessionHistoryJobs(input: {
  statusFilter: HistoryStatusFilter;
  query: string;
  offset: number;
  limit: number;
}): { jobs: HistoryJobItem[]; total: number } {
  const normalizedQuery = input.query.trim().toLowerCase();
  const filtered = readSessionHistoryJobs().filter((job) => {
    if (input.statusFilter !== "all" && job.status !== input.statusFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      job.id,
      job.chainName,
      job.sourceLabel,
      job.dataMode,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery));
  });

  return {
    jobs: filtered.slice(input.offset, input.offset + input.limit),
    total: filtered.length,
  };
}
