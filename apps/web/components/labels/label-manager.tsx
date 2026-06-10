"use client";

import { ChevronLeft, ChevronRight, Database, Plus, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supportedAnalysisChains } from "../../app/chains";
import { readJsonResponse } from "../api/read-json-response";
import { isLocalLabelSource } from "./label-display";
import { LabelFormDialog } from "./label-form-dialog";
import { LabelRecordList } from "./label-record-list";
import {
  emptyLabelForm,
  labelPageSize,
  type KnownLabelRecord,
  type LabelFormState,
  type LabelListStats,
  type LabelResponse,
  type ListChainFilter,
  type SourceFilter,
} from "./label-types";

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
  const [labels, setLabels] = useState(initialLabels);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState(initialStats);
  const [page, setPage] = useState(1);
  const [storageEnabled, setStorageEnabled] = useState(initialStorageEnabled);
  const [query, setQuery] = useState("");
  const [listChainFilter, setListChainFilter] = useState<ListChainFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [formChainId, setFormChainId] = useState(1);
  const [form, setForm] = useState<LabelFormState>(emptyLabelForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / labelPageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * labelPageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * labelPageSize, total);

  const loadLabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(labelPageSize),
        offset: String((page - 1) * labelPageSize),
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
  }, [listChainFilter, page, query, sourceFilter]);

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
    setMessage("修改后保存即可更新这条本地标签。");
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

      setMessage("本地标签已保存。");
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
              <h2 id="label-list-title">标签库</h2>
              <p>浏览分析写入的已知标签，管理团队自定义地址标签。</p>
            </div>

            <div className="labelWorkspaceActions">
              <span className={storageEnabled ? "labelStatus labelStatusOk" : "labelStatus"}>
                <Database size={14} aria-hidden="true" />
                {storageEnabled ? "数据库已连接" : "数据库未配置"}
              </span>
              <button
                type="button"
                className="labelPrimaryButton"
                onClick={openCreateDialog}
                disabled={!storageEnabled}
              >
                <Plus size={16} aria-hidden="true" />
                添加标签
              </button>
            </div>
          </div>

          <div className="labelMetricStrip" aria-label="标签库统计">
            <div className="labelMetricPill">
              <span>全部</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="labelMetricPill labelMetricPillLocal">
              <span>本地</span>
              <strong>{stats.local}</strong>
            </div>
            <div className="labelMetricPill labelMetricPillDiscovered">
              <span>分析写入</span>
              <strong>{stats.discovered}</strong>
            </div>
          </div>

          {!storageEnabled ? (
            <div className="labelStorageNotice">
              <strong>需要配置 PostgreSQL</strong>
              <p>设置 DATABASE_URL 并运行迁移后，可以在这里管理团队本地标签库。</p>
            </div>
          ) : null}

          <div className={`labelFilterBar ${isLoading ? "labelFilterBarLoading" : ""}`}>
            <label className="labelFilterField">
              <span>链</span>
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
                <option value="all">全部链</option>
                {supportedAnalysisChains.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="labelFilterField">
              <span>来源</span>
              <select
                className="labelFieldInput"
                value={sourceFilter}
                disabled={isLoading}
                onChange={(event) => {
                  setPage(1);
                  setSourceFilter(event.target.value as SourceFilter);
                }}
              >
                <option value="all">全部来源</option>
                <option value="local-labels">仅本地标签</option>
                <option value="discovered">分析写入</option>
              </select>
            </label>

            <label className="labelFilterField labelFilterSearch">
              <span>搜索</span>
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
                  placeholder="地址、标签、实体或来源"
                />
              </span>
            </label>

            <button
              type="button"
              className="labelRefreshButton"
              onClick={() => void loadLabels()}
              disabled={isLoading}
              aria-label="刷新标签列表"
            >
              <RefreshCw size={16} className={isLoading ? "historySpinIcon" : undefined} />
            </button>
          </div>

          <div className="labelListPanel">
            <LabelRecordList
              labels={labels}
              isLoading={isLoading}
              sourceFilter={sourceFilter}
              onEdit={openEditDialog}
            />
          </div>

          <div className="labelListFooter">
            <span>
              {total === 0 ? "暂无记录" : `第 ${rangeStart}-${rangeEnd} 条，共 ${total} 条`}
            </span>

            <div className="labelPagination">
              <button
                type="button"
                className="labelPaginationButton"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={isLoading || page <= 1}
                aria-label="上一页"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span>
                第 {page} / {totalPages} 页
              </span>
              <button
                type="button"
                className="labelPaginationButton"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={isLoading || page >= totalPages}
                aria-label="下一页"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>

            {error ? <span className="labelError">{error}</span> : null}
          </div>
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
