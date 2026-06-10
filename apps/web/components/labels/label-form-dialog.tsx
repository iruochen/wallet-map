"use client";

import { Save, Tag, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getEvmAggregateChains } from "../../app/chains";
import {
  emptyLabelForm,
  labelCategoryOptions,
  labelNodeKindOptions,
  type LabelFormState,
} from "./label-types";

const evmChains = getEvmAggregateChains();

export function LabelFormDialog({
  open,
  mode,
  form,
  formChainId,
  isSaving,
  message,
  error,
  onClose,
  onChangeForm,
  onChangeChainId,
  onSave,
  onReset,
}: {
  open: boolean;
  mode: "create" | "edit";
  form: LabelFormState;
  formChainId: number;
  isSaving: boolean;
  message: string | null;
  error: string | null;
  onClose: () => void;
  onChangeForm: (next: LabelFormState) => void;
  onChangeChainId: (chainId: number) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const isSavingRef = useRef(isSaving);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    isSavingRef.current = isSaving;
    onCloseRef.current = onClose;
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    addressInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSavingRef.current) {
        onCloseRef.current();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="labelDialogBackdrop" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="labelDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-form-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="historyDialogClose"
          type="button"
          onClick={onClose}
          disabled={isSaving}
          aria-label="关闭"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="labelDialogIntro">
          <div className="labelDialogIcon" aria-hidden="true">
            <Tag size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="labelDialogTitle" id="label-form-dialog-title">
              {mode === "edit" ? "更新本地标签" : "添加本地标签"}
            </h2>
            <p className="labelDialogDescription">
              保存后分析任务会通过 PostgreSQL 标签提供器读取；仅支持 EVM 地址。
            </p>
          </div>
        </div>

        <div className="labelDialogForm">
          <div className="labelDialogFormRow">
            <label>
              <span>链</span>
              <select
                className="labelFieldInput"
                value={formChainId}
                onChange={(event) => onChangeChainId(Number(event.target.value))}
              >
                {evmChains.map((chain) => (
                  <option key={chain.chainId} value={chain.chainId}>
                    {chain.name} ({chain.shortName})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>节点类型</span>
              <select
                className="labelFieldInput"
                value={form.nodeKind}
                onChange={(event) => onChangeForm({ ...form, nodeKind: event.target.value })}
              >
                {labelNodeKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="labelDialogFormWide">
            <span>地址</span>
            <input
              ref={addressInputRef}
              className="labelFieldInput labelFieldMono"
              value={form.address}
              onChange={(event) => onChangeForm({ ...form, address: event.target.value })}
              placeholder="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
              spellCheck={false}
              autoComplete="off"
            />
          </label>

          <div className="labelDialogFormRow">
            <label>
              <span>显示名称</span>
              <input
                className="labelFieldInput"
                value={form.label}
                onChange={(event) => onChangeForm({ ...form, label: event.target.value })}
                placeholder="例如：团队金库"
              />
              <small>这条地址在列表、图谱和报告中展示的名字。</small>
            </label>
            <label>
              <span>实体</span>
              <input
                className="labelFieldInput"
                value={form.entity}
                onChange={(event) => onChangeForm({ ...form, entity: event.target.value })}
                placeholder="例如：内部研究"
              />
              <small>地址归属的组织、项目或业务主体；不确定可留空。</small>
            </label>
          </div>

          <div className="labelDialogFormRow">
            <label>
              <span>分类</span>
              <select
                className="labelFieldInput"
                value={form.category}
                onChange={(event) => onChangeForm({ ...form, category: event.target.value })}
              >
                {labelCategoryOptions.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>标签组</span>
              <input
                className="labelFieldInput"
                value={form.tags}
                onChange={(event) => onChangeForm({ ...form, tags: event.target.value })}
                placeholder="watchlist, team"
              />
            </label>
          </div>
        </div>

        <div className="labelDialogActions">
          {message ? <p className="labelDialogMessage">{message}</p> : null}
          {error ? (
            <p className="labelDialogError" role="alert">
              {error}
            </p>
          ) : null}
          <div className="labelDialogActionButtons">
            <button
              type="button"
              className="historyDialogButton historyDialogButtonSecondary"
              onClick={() => {
                onReset();
                onChangeForm(emptyLabelForm);
              }}
              disabled={isSaving}
            >
              清空
            </button>
            <button
              type="button"
              className="historyDialogButton labelDialogSaveButton"
              onClick={onSave}
              disabled={isSaving}
            >
              <Save size={15} aria-hidden="true" />
              {isSaving ? "保存中…" : "保存标签"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
