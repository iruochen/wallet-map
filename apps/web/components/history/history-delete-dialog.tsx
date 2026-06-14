"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatAbsoluteTime } from "../../app/format";
import { useI18n } from "../i18n/i18n-provider";

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
  const { t } = useI18n();
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="history-delete-dialog-title"
        aria-describedby="history-delete-dialog-description"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="historyDialogClose"
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          aria-label={t("history.delete.close")}
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="historyDialogIcon historyDialogIconDanger" aria-hidden="true">
          <AlertTriangle size={22} strokeWidth={1.8} />
        </div>

        <h2 className="historyDialogTitle" id="history-delete-dialog-title">
          {t("history.delete.title")}
        </h2>
        <p className="historyDialogDescription" id="history-delete-dialog-description">
          {t("history.delete.body")}
        </p>

        <dl className="historyDialogMeta">
          <div>
            <dt>{t("history.table.time")}</dt>
            <dd>{timestamp}</dd>
          </div>
          <div>
            <dt>{t("history.table.scope")}</dt>
            <dd>{job.chainName ?? "Unknown chain"}</dd>
          </div>
          <div>
            <dt>{t("history.delete.size")}</dt>
            <dd>
              {t("history.row.stats", {
                addresses: job.watchedAddressCount ?? "—",
                events: job.eventCount ?? "—",
              })}
            </dd>
          </div>
          {job.sourceLabel ? (
            <div>
              <dt>{t("history.delete.source")}</dt>
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
            {t("history.delete.cancel")}
          </button>
          <button
            className="historyDialogButton historyDialogButtonDanger"
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 size={15} aria-hidden="true" />
            {isDeleting ? t("history.delete.confirming") : t("history.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
