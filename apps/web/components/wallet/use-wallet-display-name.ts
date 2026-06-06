"use client";

import { shortenAddress } from "../../app/format";
import { useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";

export function useWalletDisplayName(address: string | undefined | null) {
  const normalizedAddress = address?.toLowerCase() as `0x${string}` | undefined;
  const { data: ensName, isLoading } = useEnsName({
    address: normalizedAddress,
    chainId: mainnet.id,
  });

  const resolvedEnsName = ensName?.trim() || undefined;
  const addressLabel = normalizedAddress ? shortenAddress(normalizedAddress) : undefined;
  const displayName = resolvedEnsName ?? addressLabel;

  return {
    ensName: resolvedEnsName,
    addressLabel,
    displayName,
    isLoading: Boolean(normalizedAddress) && isLoading,
  };
}
