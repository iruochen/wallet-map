"use client";

import { useEffect, useState } from "react";
import { shortenAddress } from "../../app/format";

function normalizeAddress(address: string | undefined | null): string | undefined {
  const normalized = address?.trim().toLowerCase();

  if (!normalized || !/^0x[a-f0-9]{40}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

export function useWalletDisplayName(address: string | undefined | null) {
  const normalizedAddress = normalizeAddress(address);
  const [ensName, setEnsName] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!normalizedAddress) {
      setEnsName(undefined);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    void fetch(`/api/wallet/ens?address=${encodeURIComponent(normalizedAddress)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return undefined;
        }

        const body = (await response.json()) as { name?: string | null };
        return body.name?.trim() || undefined;
      })
      .then((name) => {
        if (controller.signal.aborted) {
          return;
        }

        setEnsName(name);
        setIsLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }

        setEnsName(undefined);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [normalizedAddress]);

  const addressLabel = normalizedAddress ? shortenAddress(normalizedAddress) : undefined;
  const displayName = ensName ?? addressLabel;

  return {
    ensName,
    addressLabel,
    displayName,
    isLoading: Boolean(normalizedAddress) && isLoading,
  };
}
