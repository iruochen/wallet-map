"use client";

import { ExternalLink, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildExplorerAddressUrl } from "../../app/chains";
import { shortenAddress } from "../../app/format";
import { useI18n } from "../i18n/i18n-provider";
import {
  formatLocalizedLabelCategory,
  formatLocalizedLabelNodeKind,
  formatLocalizedLabelSource,
  formatLabelChainShort,
  isLocalLabelSource,
} from "./lib/label-display";
import type { KnownLabelRecord } from "./lib/label-types";

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
  const { t } = useI18n();
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  function handleScroll() {
    setIsScrolling(true);

    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 700);
  }

  if (isLoading) {
    return (
      <div className="labelRecordList labelRecordListLoading" aria-label={t("labels.loading")}>
        <LabelRecordHeader t={t} />
        <LabelRecordSkeleton />
      </div>
    );
  }

  if (labels.length === 0) {
    return (
      <div className="labelRecordEmpty">
        <strong>{t("labels.empty.title")}</strong>
        <p>
          {sourceFilter === "local-labels"
            ? t("labels.empty.local.body")
            : t("labels.empty.filtered.body")}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`labelRecordList ${isScrolling ? "labelRecordListScrolling" : ""}`}
      onScroll={handleScroll}
    >
      <LabelRecordHeader t={t} />

      <div className="labelRecordBody">
        {labels.map((label) => (
          <LabelRecordRow key={label.id} label={label} onEdit={onEdit} t={t} />
        ))}
      </div>
    </div>
  );
}

function LabelRecordHeader({ t }: { t: ReturnType<typeof useI18n>["t"] }) {
  return (
    <div className="labelRecordHeader" aria-hidden="true">
      <span>{t("labels.table.label")}</span>
      <span>{t("labels.table.address")}</span>
      <span>{t("labels.table.chain")}</span>
      <span>{t("labels.table.source")}</span>
      <span>{t("labels.table.tags")}</span>
      <span>{t("labels.table.actions")}</span>
    </div>
  );
}

function LabelRecordSkeleton() {
  return (
    <div className="labelRecordBody labelRecordSkeleton" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="labelRecordSkeletonRow" key={index}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function LabelRecordRow({
  label,
  onEdit,
  t,
}: {
  label: KnownLabelRecord;
  onEdit: (label: KnownLabelRecord) => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const explorerHref = buildExplorerAddressUrl(label.chainId, label.address);
  const subtitle =
    label.entity ??
    formatLocalizedLabelCategory(t, label.category) ??
    formatLocalizedLabelNodeKind(t, label.nodeKind);
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
        <span className="labelChainBadge" title={formatLabelChainShort(label.chainId)}>
          {formatLabelChainShort(label.chainId)}
        </span>
      </div>

      <div className="labelRecordCell labelRecordCellSource">
        <span className={isLocal ? "labelSourceBadge labelSourceBadgeLocal" : "labelSourceBadge"}>
          {formatLocalizedLabelSource(t, label.source)}
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
            {t("labels.action.edit")}
          </button>
        ) : (
          <span className="labelRowActionMuted">{t("labels.action.readonly")}</span>
        )}
      </div>
    </article>
  );
}
