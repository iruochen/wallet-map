"use client";

import { Save, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { getEvmAggregateChains } from "../../app/chains";
import { useI18n, type I18nKey } from "../i18n/i18n-provider";
import {
  emptyLabelForm,
  labelCategoryOptions,
  labelNodeKindOptions,
  type LabelFormState,
} from "./lib/label-types";

const evmChains = getEvmAggregateChains();

const categoryLabelKeys: Record<string, I18nKey> = {
  "": "labels.form.category.none",
  exchange: "labels.category.exchange",
  bridge: "labels.category.bridge",
  dex: "labels.category.dex",
  defi: "labels.category.defi",
  stablecoin: "labels.category.stablecoin",
  token: "labels.category.token",
  contract: "labels.category.contract",
  wallet: "labels.category.wallet",
  unknown: "labels.category.unknown",
};

const nodeKindLabelKeys: Record<string, I18nKey> = {
  wallet: "labels.nodeKind.wallet",
  contract: "labels.nodeKind.contract",
  entity: "labels.nodeKind.entity",
  asset: "labels.nodeKind.asset",
};

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
  const { t } = useI18n();
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const isSavingRef = useRef(isSaving);
  const onCloseRef = useRef(onClose);
  const categoryOptions = useMemo(
    () =>
      labelCategoryOptions.map((option) => ({
        value: option.value,
        label: t(categoryLabelKeys[option.value] ?? "labels.category.unknown"),
      })),
    [t],
  );
  const nodeKindOptions = useMemo(
    () =>
      labelNodeKindOptions.map((option) => ({
        value: option.value,
        label: t(nodeKindLabelKeys[option.value] ?? "labels.nodeKind.wallet"),
      })),
    [t],
  );

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
          aria-label={t("labels.dialog.close")}
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="labelDialogIntro">
          <div className="labelDialogIcon" aria-hidden="true">
            <Tag size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="labelDialogTitle" id="label-form-dialog-title">
              {mode === "edit" ? t("labels.dialog.edit.title") : t("labels.dialog.create.title")}
            </h2>
            <p className="labelDialogDescription">{t("labels.dialog.description")}</p>
          </div>
        </div>

        <div className="labelDialogForm">
          <div className="labelDialogFormRow">
            <label>
              <span>{t("labels.form.chain")}</span>
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
              <span>{t("labels.form.nodeKind")}</span>
              <select
                className="labelFieldInput"
                value={form.nodeKind}
                onChange={(event) => onChangeForm({ ...form, nodeKind: event.target.value })}
              >
                {nodeKindOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="labelDialogFormWide">
            <span>{t("labels.form.address")}</span>
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
              <span>{t("labels.form.displayName")}</span>
              <input
                className="labelFieldInput"
                value={form.label}
                onChange={(event) => onChangeForm({ ...form, label: event.target.value })}
                placeholder={t("labels.form.displayName.placeholder")}
              />
              <small>{t("labels.form.displayName.hint")}</small>
            </label>
            <label>
              <span>{t("labels.form.entity")}</span>
              <input
                className="labelFieldInput"
                value={form.entity}
                onChange={(event) => onChangeForm({ ...form, entity: event.target.value })}
                placeholder={t("labels.form.entity.placeholder")}
              />
              <small>{t("labels.form.entity.hint")}</small>
            </label>
          </div>

          <div className="labelDialogFormRow">
            <label>
              <span>{t("labels.form.category")}</span>
              <select
                className="labelFieldInput"
                value={form.category}
                onChange={(event) => onChangeForm({ ...form, category: event.target.value })}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("labels.form.tags")}</span>
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
              {t("labels.action.clear")}
            </button>
            <button
              type="button"
              className="historyDialogButton labelDialogSaveButton"
              onClick={onSave}
              disabled={isSaving}
            >
              <Save size={15} aria-hidden="true" />
              {isSaving ? t("labels.action.saving") : t("labels.action.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
