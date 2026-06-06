"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatAbsoluteTime } from "../../app/format";

export interface HistoryDeleteDialogJob {
  id: string;
  chainName?: string;
  sourceLabel?: string;
  completedAt?: string;
  createdAt: string;
  watchedAddressCount?: number;
  eventCount?: number;
}

export function HistoryDeleteDialog({
  job,
  isDeleting,
  deleteError,
  onCancel,
  onConfirm,
}: {
  job: HistoryDeleteDialogJob;
  isDeleting: boolean;
  deleteError?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel]);

  const timestamp = formatAbsoluteTime(job.completedAt ?? job.createdAt) ?? job.createdAt;

  return (
    <div className="historyDialogBackdrop" role="presentation" onClick={isDeleting ? undefined : onCancel}>
      <div
        className="historyDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-delete-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="historyDialogClose"
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="关闭"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="historyDialogIcon historyDialogIconDanger" aria-hidden="true">
          <AlertTriangle size={22} strokeWidth={1.8} />
        </div>

        <h2 className="historyDialogTitle" id="history-delete-dialog-title">
          删除这条分析记录？
        </h2>
        <p className="historyDialogDescription">
          删除后会从钱包历史中永久移除这条记录，包括图谱、发现和事件快照，且无法恢复。
        </p>

        <dl className="historyDialogMeta">
          <div>
            <dt>时间</dt>
            <dd>{timestamp}</dd>
          </div>
          <div>
            <dt>范围</dt>
            <dd>{job.chainName ?? "Unknown chain"}</dd>
          </div>
          <div>
            <dt>规模</dt>
            <dd>
              {job.watchedAddressCount ?? "—"} 地址 · {job.eventCount ?? "—"} 事件
            </dd>
          </div>
          {job.sourceLabel ? (
            <div>
              <dt>来源</dt>
              <dd>{job.sourceLabel}</dd>
            </div>
          ) : null}
        </dl>

        <div className="historyDialogActions">
          {deleteError ? (
            <p className="historyDialogError" role="alert">
              {deleteError}
            </p>
          ) : null}
          <button
            ref={cancelButtonRef}
            className="historyDialogButton historyDialogButtonSecondary"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            取消
          </button>
          <button
            className="historyDialogButton historyDialogButtonDanger"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 size={15} aria-hidden="true" />
            {isDeleting ? "删除中…" : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
