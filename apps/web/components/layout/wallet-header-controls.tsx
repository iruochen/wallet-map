"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, LogOut, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useWalletDisplayName } from "../wallet/use-wallet-display-name";

export function WalletHeaderControls() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null);

  const loadAuthSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const body = (await response.json()) as { authenticated?: boolean; address?: string };

      if (body.authenticated && body.address) {
        setAuthenticatedAddress(body.address.toLowerCase());
        return;
      }

      setAuthenticatedAddress(null);
    } catch {
      setAuthenticatedAddress(null);
    }
  }, []);

  useEffect(() => {
    void loadAuthSession();
  }, [loadAuthSession]);

  useEffect(() => {
    function handleAuthChanged() {
      void loadAuthSession();
    }

    window.addEventListener("wallet-map-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("wallet-map-auth-changed", handleAuthChanged);
  }, [loadAuthSession]);

  const connectedAddress = address?.toLowerCase();
  const { displayName, ensName } = useWalletDisplayName(address);
  const isAuthenticated =
    Boolean(connectedAddress) &&
    Boolean(authenticatedAddress) &&
    connectedAddress === authenticatedAddress;

  async function refreshAuthState() {
    window.dispatchEvent(new Event("wallet-map-auth-changed"));
    router.refresh();
  }

  async function signIn() {
    setIsBusy(true);
    setError(null);

    try {
      if (!address || !isConnected) {
        throw new Error("请先连接钱包。");
      }

      const challengeResponse = await fetch("/api/auth/challenge", { method: "POST" });
      const challenge = (await challengeResponse.json()) as { message?: string; error?: string };

      if (!challengeResponse.ok || !challenge.message) {
        throw new Error(challenge.error ?? "无法创建登录挑战。");
      }

      const signature = await signMessageAsync({ message: challenge.message });
      const loginResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, message: challenge.message, signature }),
      });
      const login = (await loginResponse.json()) as { error?: string };

      if (!loginResponse.ok) {
        throw new Error(login.error ?? "钱包登录失败。");
      }

      await refreshAuthState();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "钱包登录失败。");
    } finally {
      setIsBusy(false);
    }
  }

  async function disconnect() {
    setIsBusy(true);
    setError(null);

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await disconnectAsync().catch(() => undefined);
      await refreshAuthState();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="walletHeaderControl">
      {isConnected && address ? (
        <>
          {isAuthenticated ? (
            <span
              className="headerChip headerChipOk walletHeaderSignedChip"
              title={ensName ? address : undefined}
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              已登录 {displayName ?? address}
            </span>
          ) : (
            <button className="walletHeaderButton walletHeaderButtonPrimary" type="button" onClick={signIn} disabled={isBusy}>
              <CheckCircle2 size={15} aria-hidden="true" />
              {isBusy ? "签名中" : `签名 ${displayName ?? address}`}
            </button>
          )}
          <button className="walletHeaderIconButton" type="button" onClick={disconnect} disabled={isBusy} title="断开钱包">
            <LogOut size={15} aria-hidden="true" />
          </button>
        </>
      ) : (
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <button
              className="walletHeaderButton walletHeaderButtonPrimary"
              type="button"
              onClick={openConnectModal}
              disabled={!mounted || isBusy}
            >
              <Wallet size={15} aria-hidden="true" />
              连接钱包
            </button>
          )}
        </ConnectButton.Custom>
      )}
      {error ? <span className="walletHeaderError">{error}</span> : null}
    </div>
  );
}
