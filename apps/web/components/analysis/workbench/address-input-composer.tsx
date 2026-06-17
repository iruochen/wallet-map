"use client";

import { WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { shortenAddress } from "../../../app/format";
import { useI18n } from "../../i18n/i18n-provider";
import { mergeAddressInput, parseAddressImport } from "../lib/address-import";

interface AddressInputComposerProps {
  id?: string;
  addresses: string;
  disabled?: boolean;
  onChange: (addresses: string) => void;
  onImportSummaryClear?: () => void;
}

export function AddressInputComposer({
  id = "addresses",
  addresses,
  disabled = false,
  onChange,
  onImportSummaryClear,
}: AddressInputComposerProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState("");
  const parsedAddresses = useMemo(() => parseAddressImport(addresses).addresses, [addresses]);
  const isEmpty = parsedAddresses.length === 0 && draft.trim().length === 0;

  useEffect(() => {
    setDraft("");
  }, [addresses]);

  function clearImportSummary() {
    onImportSummaryClear?.();
  }

  function updateAddresses(next: string) {
    onChange(next);
    clearImportSummary();
  }

  function removeAddress(target: string) {
    updateAddresses(parsedAddresses.filter((address) => address !== target).join("\n"));
  }

  function commitDraft(rawDraft = draft) {
    const trimmed = rawDraft.trim();
    if (!trimmed) {
      setDraft("");
      return;
    }

    const next = mergeAddressInput(addresses, trimmed);
    if (next !== addresses) {
      updateAddresses(next);
    }
    setDraft("");
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.trim()) {
      return;
    }

    event.preventDefault();
    const next = mergeAddressInput(addresses, pasted);
    if (next !== addresses) {
      updateAddresses(next);
    }
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Backspace" && draft.length === 0 && parsedAddresses.length > 0) {
      event.preventDefault();
      removeAddress(parsedAddresses[parsedAddresses.length - 1]!);
    }
  }

  return (
    <div
      className={`addressInputComposer ${isEmpty ? "addressInputComposerEmpty" : ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      {isEmpty ? (
        <WalletCards size={18} strokeWidth={1.9} className="addressInputComposerIcon" aria-hidden="true" />
      ) : null}
      <div className="addressInputChipField">
        {parsedAddresses.map((address) => (
          <span className="addressChip" key={address}>
            <code title={address}>{shortenAddress(address)}</code>
            <button
              type="button"
              className="addressChipRemove"
              disabled={disabled}
              aria-label={shortenAddress(address)}
              onClick={(event) => {
                event.stopPropagation();
                removeAddress(address);
              }}
            >
              <X size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          name={id}
          className="addressInputInline"
          type="text"
          disabled={disabled}
          value={draft}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={
            parsedAddresses.length > 0
              ? t("analysis.address.placeholderMore")
              : t("analysis.address.placeholder")
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => commitDraft()}
        />
      </div>
    </div>
  );
}
