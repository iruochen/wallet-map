"use client";

import { ExternalLink, Pencil, RefreshCw } from "lucide-react";
import { buildExplorerAddressUrl } from "../../app/chains";
import { shortenAddress } from "../../app/format";
import {
  formatLabelCategory,
  formatLabelChainName,
  formatLabelChainShort,
  formatLabelNodeKind,
  formatLabelSource,
  isLocalLabelSource,
} from "./label-display";
import type { KnownLabelRecord } from "./label-types";

export function LabelRecordList({
  labels,
  isLoading,
  sourceFilter,
  onEdit,
}: {
  labels: KnownLabelRecord[];
  isLoading: boolean;
  sourceFilter: string;
  onEdit: (label: KnownLabelRecord) => void;
}) {
  if (labels.length === 0) {
    return (
      <div className="labelRecordEmpty">
        <strong>{isLoading ? "加载中…" : "暂无匹配记录"}</strong>
        <p>
          {sourceFilter === "local-labels"
            ? "还没有本地标签。点击右上角「添加标签」创建第一条。"
            : "试试调整筛选条件，或添加一条本地标签。"}
        </p>
      </div>
    );
  }

  return (
    <div className={`labelRecordList ${isLoading ? "labelRecordListLoading" : ""}`}>
      {isLoading ? (
        <div className="labelRecordLoadingOverlay" role="status" aria-live="polite">
          <RefreshCw size={18} className="historySpinIcon" aria-hidden="true" />
          <span>正在加载标签…</span>
        </div>
      ) : null}

      <div className="labelRecordHeader" aria-hidden="true">
        <span>标签</span>
        <span>地址</span>
        <span>链</span>
        <span>来源</span>
        <span>标签组</span>
        <span>操作</span>
      </div>

      <div className="labelRecordBody">
        {labels.map((label) => (
          <LabelRecordRow key={label.id} label={label} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}

function LabelRecordRow({
  label,
  onEdit,
}: {
  label: KnownLabelRecord;
  onEdit: (label: KnownLabelRecord) => void;
}) {
  const explorerHref = buildExplorerAddressUrl(label.chainId, label.address);
  const subtitle =
    label.entity ?? formatLabelCategory(label.category) ?? formatLabelNodeKind(label.nodeKind);
  const isLocal = isLocalLabelSource(label.source);
  const visibleTags = label.tags.slice(0, 5);
  const hiddenTagCount = Math.max(0, label.tags.length - visibleTags.length);

  return (
    <article className={`labelRecordRow ${isLocal ? "labelRecordRowLocal" : ""}`}>
      <div className="labelRecordCell labelRecordCellName">
        <strong>{label.label}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>

      <div className="labelRecordCell labelRecordCellAddress">
        {explorerHref ? (
          <a href={explorerHref} target="_blank" rel="noreferrer" title={label.address}>
            <code>{shortenAddress(label.address)}</code>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : (
          <code title={label.address}>{shortenAddress(label.address)}</code>
        )}
      </div>

      <div className="labelRecordCell labelRecordCellChain">
        <span className="labelChainBadge" title={formatLabelChainName(label.chainId)}>
          {formatLabelChainShort(label.chainId)}
        </span>
      </div>

      <div className="labelRecordCell labelRecordCellSource">
        <span className={isLocal ? "labelSourceBadge labelSourceBadgeLocal" : "labelSourceBadge"}>
          {formatLabelSource(label.source)}
        </span>
      </div>

      <div className="labelRecordCell labelRecordCellTags">
        {visibleTags.length ? (
          <div className="labelTagList">
            {visibleTags.map((tag) => (
              <span key={tag} className="labelTagChip" title={tag}>
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 ? <span className="labelTagMore">+{hiddenTagCount}</span> : null}
          </div>
        ) : (
          <span className="labelTagEmpty">—</span>
        )}
      </div>

      <div className="labelRecordCell labelRecordCellActions">
        {isLocal ? (
          <button type="button" className="labelRowAction" onClick={() => onEdit(label)}>
            <Pencil size={14} aria-hidden="true" />
            编辑
          </button>
        ) : (
          <span className="labelRowActionMuted">只读</span>
        )}
      </div>
    </article>
  );
}
