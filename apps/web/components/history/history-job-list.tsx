"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAbsoluteTime } from "../../app/format";
import { formatConfidenceLabel } from "../analysis/analysis-formatters";

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

export function HistoryJobList() {
  const [jobs, setJobs] = useState<HistoryJobItem[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadJobs();
  }, []);

  async function loadJobs() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze/jobs?limit=30");
      const body = (await response.json()) as {
        jobs?: HistoryJobItem[];
        storageEnabled?: boolean;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load history.");
      }

      setJobs(body.jobs ?? []);
      setStorageEnabled(body.storageEnabled !== false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load history.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <div className="historyEmpty">正在加载历史记录…</div>;
  }

  if (!storageEnabled) {
    return (
      <div className="historyEmpty">
        <strong>数据库未配置</strong>
        <p>在 Vercel 或本地配置 `DATABASE_URL` 并执行 migration 后，分析结果会自动保存到这里。</p>
      </div>
    );
  }

  if (error) {
    const needsMigration = error.includes('column "chain_name" does not exist');

    return (
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
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="historyEmpty">
        <strong>还没有历史记录</strong>
        <p>完成一次分析后，任务摘要会写入 PostgreSQL，并显示在此列表。</p>
        <Link className="secondaryButton" href="/">
          去运行分析
        </Link>
      </div>
    );
  }

  return (
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
                    打开
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
