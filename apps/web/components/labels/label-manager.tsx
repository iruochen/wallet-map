"use client";

import { RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface KnownLabelRecord {
  id: string;
  nodeKind: "wallet" | "contract" | "entity" | "asset";
  chainId: number;
  address: string;
  label: string;
  entity?: string;
  category?: string;
  tags: string[];
  source: string;
  confidence?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

interface LabelResponse {
  labels?: KnownLabelRecord[];
  storageEnabled?: boolean;
  error?: string;
}

const categoryOptions = [
  "",
  "exchange",
  "bridge",
  "dex",
  "defi",
  "stablecoin",
  "token",
  "contract",
  "wallet",
  "unknown",
];

export function LabelManager({ initialLabels, initialStorageEnabled }: {
  initialLabels: KnownLabelRecord[];
  initialStorageEnabled: boolean;
}) {
  const [labels, setLabels] = useState(initialLabels);
  const [storageEnabled, setStorageEnabled] = useState(initialStorageEnabled);
  const [query, setQuery] = useState("");
  const [chainId, setChainId] = useState("1");
  const [form, setForm] = useState({
    address: "",
    label: "",
    entity: "",
    category: "",
    tags: "",
    nodeKind: "wallet",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const localLabelCount = useMemo(
    () => labels.filter((label) => label.source === "local-labels").length,
    [labels],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLabels();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, chainId]);

  async function loadLabels() {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: "100" });

      if (query.trim()) {
        params.set("query", query.trim());
      }

      if (chainId.trim()) {
        params.set("chainId", chainId.trim());
      }

      const response = await fetch(`/api/labels?${params.toString()}`);
      const body = (await response.json()) as LabelResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to load labels.");
      }

      setLabels(body.labels ?? []);
      setStorageEnabled(body.storageEnabled !== false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load labels.");
    } finally {
      setIsLoading(false);
    }
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
          chainId: Number(chainId || 1),
          category: form.category || undefined,
          tags: form.tags,
        }),
      });
      const body = (await response.json()) as LabelResponse & { label?: KnownLabelRecord };

      if (!response.ok) {
        throw new Error(body.error ?? "Failed to save label.");
      }

      setMessage("本地标签已保存。");
      setForm((current) => ({ ...current, address: "", label: "", entity: "", tags: "" }));
      await loadLabels();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save label.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="labelManager">
      <section className="labelFormPanel" aria-labelledby="label-form-title">
        <div className="labelPanelHeader">
          <div>
            <span className="panelEyebrow">Local labels</span>
            <h2 id="label-form-title">添加或更新标签</h2>
          </div>
          <span className={storageEnabled ? "labelStatus labelStatusOk" : "labelStatus"}>
            {storageEnabled ? "数据库已启用" : "数据库未配置"}
          </span>
        </div>

        {!storageEnabled ? (
          <div className="emptyStateBlock">
            <strong>需要配置 PostgreSQL</strong>
            <p>设置 `DATABASE_URL` 并运行迁移后，可以在这里管理团队本地标签库。</p>
          </div>
        ) : null}

        <div className="labelFormGrid">
          <label>
            <span>Chain ID</span>
            <input value={chainId} onChange={(event) => setChainId(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            <span>Node kind</span>
            <select
              value={form.nodeKind}
              onChange={(event) => setForm((current) => ({ ...current, nodeKind: event.target.value }))}
            >
              <option value="wallet">wallet</option>
              <option value="contract">contract</option>
              <option value="entity">entity</option>
              <option value="asset">asset</option>
            </select>
          </label>
          <label className="labelFormWide">
            <span>Address</span>
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            />
          </label>
          <label>
            <span>Label</span>
            <input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Treasury wallet"
            />
          </label>
          <label>
            <span>Entity</span>
            <input
              value={form.entity}
              onChange={(event) => setForm((current) => ({ ...current, entity: event.target.value }))}
              placeholder="Internal research"
            />
          </label>
          <label>
            <span>Category</span>
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            >
              {categoryOptions.map((category) => (
                <option key={category || "none"} value={category}>
                  {category || "none"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tags</span>
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="watchlist,team"
            />
          </label>
        </div>

        <div className="labelFormActions">
          <button type="button" onClick={() => void saveLabel()} disabled={!storageEnabled || isSaving}>
            <Save size={16} />
            {isSaving ? "保存中" : "保存标签"}
          </button>
          {message ? <span className="labelMessage">{message}</span> : null}
          {error ? <span className="labelError">{error}</span> : null}
        </div>
      </section>

      <section className="labelListPanel" aria-labelledby="label-list-title">
        <div className="labelPanelHeader">
          <div>
            <span className="panelEyebrow">Known labels</span>
            <h2 id="label-list-title">标签库</h2>
            <p>{labels.length} 条记录，{localLabelCount} 条本地标签。</p>
          </div>
          <button type="button" className="historyIconButton" onClick={() => void loadLabels()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? "historySpinIcon" : undefined} />
          </button>
        </div>

        <label className="labelSearch">
          <span>搜索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="按地址、标签、实体或来源过滤"
          />
        </label>

        <div className="labelTableWrap">
          {labels.length === 0 ? (
            <div className="emptyStateBlock">
              <strong>暂无标签记录</strong>
              <p>保存第一条本地标签后，分析图谱会通过 PostgreSQL 标签提供器读取它。</p>
            </div>
          ) : (
            <table className="labelTable">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Address</th>
                  <th>Source</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label) => (
                  <tr key={label.id}>
                    <td>
                      <strong>{label.label}</strong>
                      <span>{label.entity ?? label.category ?? label.nodeKind}</span>
                    </td>
                    <td>
                      <code>{label.address}</code>
                      <span>chain {label.chainId}</span>
                    </td>
                    <td>{label.source}</td>
                    <td>{label.tags.length ? label.tags.join(", ") : "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
