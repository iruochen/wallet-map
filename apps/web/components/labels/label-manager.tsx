"use client";

import { ChevronLeft, ChevronRight, Database, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supportedAnalysisChains } from "../../app/chains";
import { readJsonResponse } from "../../lib/read-json-response";
import { useI18n } from "../i18n/i18n-provider";
import { isLocalLabelSource } from "./lib/label-display";
import { LabelFormDialog } from "./label-form-dialog";
import { LabelRecordList } from "./label-record-list";
import {
  emptyLabelForm,
  defaultLabelPageSize,
  labelPageSizeOptions,
  type KnownLabelRecord,
  type LabelFormState,
  type LabelListStats,
  type LabelResponse,
  type ListChainFilter,
  type SourceFilter,
} from "./lib/label-types";

export function LabelManager({
  initialLabels,
  initialTotal,
  initialStats,
  initialStorageEnabled,
}: {
  initialLabels: KnownLabelRecord[];
  initialTotal: number;
  initialStats: LabelListStats;
  initialStorageEnabled: boolean;
}) {
  const { t } = useI18n();
  const [labels, setLabels] = useState(initialLabels);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState(initialStats);
  const [page, setPage] = useState(1);
  const [storageEnabled, setStorageEnabled] = useState(initialStorageEnabled);
  const [query, setQuery] = useState("");
  const [listChainFilter, setListChainFilter] = useState<ListChainFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [pageSize, setPageSize] = useState(defaultLabelPageSize);
  const [formChainId, setFormChainId] = useState(1);
  const [form, setForm] = useState<LabelFormState>(emptyLabelForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  const loadLabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
        sourceMode: sourceFilter,
      });

      if (query.trim()) {
        params.set("query", query.trim());
      }

      if (listChainFilter !== "all") {
        params.set("chainId", String(listChainFilter));
      }

      const response = await fetch(`/api/labels?${params.toString()}`);
      const body = await readJsonResponse<LabelResponse>(response);

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load labels.");
      }

      setLabels(body.labels ?? []);
      setTotal(body.total ?? 0);
      setStats(body.stats ?? { total: 0, local: 0, discovered: 0 });
      setStorageEnabled(body.storageEnabled !== false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load labels.");
    } finally {
      setIsLoading(false);
    }
  }, [listChainFilter, page, pageSize, query, sourceFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLabels();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadLabels]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openCreateDialog() {
    setDialogMode("create");
    setForm(emptyLabelForm);
    setFormChainId(1);
    setMessage(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(label: KnownLabelRecord) {
    if (!isLocalLabelSource(label.source)) {
      return;
    }

    setDialogMode("edit");
    setFormChainId(label.chainId);
    setForm({
      address: label.address,
      label: label.label,
      entity: label.entity ?? "",
      category: label.category ?? "",
      tags: label.tags.join(", "),
      nodeKind: label.nodeKind,
    });
    setMessage(t("labels.dialog.edit.hint"));
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (isSaving) {
      return;
    }

    setDialogOpen(false);
    setMessage(null);
    setError(null);
  }

  async function saveLabel() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          chainId: formChainId,
          category: form.category || undefined,
          tags: form.tags,
        }),
      });
      const body = await readJsonResponse<LabelResponse & { label?: KnownLabelRecord }>(response);

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save label.");
      }

      setMessage(t("labels.dialog.saved"));
      setForm(emptyLabelForm);
      await loadLabels();

      window.setTimeout(() => {
        setDialogOpen(false);
        setMessage(null);
      }, 700);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save label.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="labelManager">
        <section className="labelWorkspace" aria-labelledby="label-list-title">
          <div className="labelWorkspaceTop">
            <div className="labelWorkspaceIntro">
              <h2 id="label-list-title">{t("labels.title")}</h2>
            </div>

            <div className="labelWorkspaceActions">
              <span className={storageEnabled ? "labelStatus labelStatusOk" : "labelStatus"}>
                <Database size={14} aria-hidden="true" />
                {storageEnabled ? t("labels.storage.connected") : t("labels.storage.missing")}
              </span>
              <button
                type="button"
                className="labelPrimaryButton"
                onClick={openCreateDialog}
                disabled={!storageEnabled}
              >
                <Plus size={16} aria-hidden="true" />
                {t("labels.action.add")}
              </button>
            </div>
          </div>

          <div className="labelMetricStrip" aria-label={t("labels.title")}>
            <div className="labelMetricPill">
              <span>{t("labels.metric.all")}</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="labelMetricPill labelMetricPillLocal">
              <span>{t("labels.metric.local")}</span>
              <strong>{stats.local}</strong>
            </div>
            <div className="labelMetricPill labelMetricPillDiscovered">
              <span>{t("labels.metric.discovered")}</span>
              <strong>{stats.discovered}</strong>
            </div>
          </div>

          {!storageEnabled ? (
            <div className="labelStorageNotice">
              <strong>{t("labels.storage.notice.title")}</strong>
              <p>{t("labels.storage.notice.body")}</p>
            </div>
          ) : null}

          <div className={`labelFilterBar ${isLoading ? "labelFilterBarLoading" : ""}`}>
            <label className="labelFilterField">
              <span>{t("labels.filter.chain")}</span>
              <select
                className="labelFieldInput"
                value={listChainFilter === "all" ? "all" : String(listChainFilter)}
                disabled={isLoading}
                onChange={(event) => {
                  const value = event.target.value;
                  setPage(1);
                  setListChainFilter(value === "all" ? "all" : Number(value));
                }}
              >
                <option value="all">{t("labels.filter.chain.all")}</option>
                {supportedAnalysisChains.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="labelFilterField">
              <span>{t("labels.filter.source")}</span>
              <select
                className="labelFieldInput"
                value={sourceFilter}
                disabled={isLoading}
                onChange={(event) => {
                  setPage(1);
                  setSourceFilter(event.target.value as SourceFilter);
                }}
              >
                <option value="all">{t("labels.filter.source.all")}</option>
                <option value="local-labels">{t("labels.filter.source.local")}</option>
                <option value="discovered">{t("labels.filter.source.discovered")}</option>
              </select>
            </label>

            <label className="labelFilterField labelFilterSearch">
              <span>{t("labels.filter.search")}</span>
              <span className="labelSearchInputWrap">
                <Search size={15} aria-hidden="true" />
                <input
                  className="labelFieldInput"
                  value={query}
                  disabled={isLoading}
                  onChange={(event) => {
                    setPage(1);
                    setQuery(event.target.value);
                  }}
                  placeholder={t("labels.filter.search.placeholder")}
                />
              </span>
            </label>

            <button
              type="button"
              className="labelRefreshButton"
              onClick={() => void loadLabels()}
              disabled={isLoading}
              aria-label={t("labels.action.refresh")}
            >
              <RefreshCw size={16} className={isLoading ? "historySpinIcon" : undefined} />
            </button>
          </div>

          <div className="labelResultBar">
            <span>
              {total === 0
                ? t("labels.result.empty")
                : t("labels.result.range", { start: rangeStart, end: rangeEnd, total })}
            </span>
            <div className="labelResultActions">
              <label className="labelPageSizeControl">
                <span>{t("labels.filter.pageSize")}</span>
                <select
                  className="labelFieldInput"
                  value={pageSize}
                  disabled={isLoading}
                  onChange={(event) => {
                    setPage(1);
                    setPageSize(Number(event.target.value));
                  }}
                >
                  {labelPageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <LabelPaginationControls
                page={page}
                totalPages={totalPages}
                isLoading={isLoading}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
                t={t}
              />
            </div>
          </div>

          <div className="labelListPanel">
            <LabelRecordList
              labels={labels}
              isLoading={isLoading}
              sourceFilter={sourceFilter}
              onEdit={openEditDialog}
            />
          </div>

          {error ? (
            <div className="labelListFooter">
              <span className="labelError">{error}</span>
            </div>
          ) : null}
        </section>
      </div>

      <LabelFormDialog
        open={dialogOpen}
        mode={dialogMode}
        form={form}
        formChainId={formChainId}
        isSaving={isSaving}
        message={message}
        error={error}
        onClose={closeDialog}
        onChangeForm={setForm}
        onChangeChainId={setFormChainId}
        onSave={() => void saveLabel()}
        onReset={() => {
          setMessage(null);
          setError(null);
        }}
      />
    </>
  );
}

function LabelPaginationControls({
  page,
  totalPages,
  isLoading,
  onPrevious,
  onNext,
  t,
}: {
  page: number;
  totalPages: number;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <div className="labelPaginationControls">
      <button
        type="button"
        className="labelPaginationButton"
        onClick={onPrevious}
        disabled={isLoading || page <= 1}
        aria-label={t("labels.pagination.previous")}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <span>{t("labels.pagination.page", { page, totalPages })}</span>
      <button
        type="button"
        className="labelPaginationButton"
        onClick={onNext}
        disabled={isLoading || page >= totalPages}
        aria-label={t("labels.pagination.next")}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
