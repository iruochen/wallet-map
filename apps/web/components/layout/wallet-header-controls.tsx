"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, LogOut, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { readJsonResponse } from "../../lib/read-json-response";
import { useI18n } from "../i18n/i18n-provider";
import { useWalletDisplayName } from "../wallet/use-wallet-display-name";

export function WalletHeaderControls() {
  const { t } = useI18n();
  const router = useRouter();
  const { address, isConnected, status: walletStatus } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isBusy, setIsBusy] = useState(false);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticatedAddress, setAuthenticatedAddress] = useState<string | null>(null);
  const autoSignAttemptRef = useRef<string | null>(null);

  const loadAuthSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const body = await readJsonResponse<{ authenticated?: boolean; address?: string }>(response);

      if (body.authenticated && body.address) {
        setAuthenticatedAddress(body.address.toLowerCase());
        return;
      }

      setAuthenticatedAddress(null);
    } catch {
      setAuthenticatedAddress(null);
    } finally {
      setAuthLoaded(true);
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
  const displayAddress = connectedAddress ?? authenticatedAddress ?? undefined;
  const { displayName, ensName } = useWalletDisplayName(displayAddress);
  const hasServerSession = Boolean(authenticatedAddress);
  const isWalletRestoring = walletStatus === "connecting" || walletStatus === "reconnecting";
  const walletMatchesSession =
    Boolean(connectedAddress) &&
    Boolean(authenticatedAddress) &&
    connectedAddress === authenticatedAddress;
  const needsWalletSignIn =
    authLoaded &&
    isConnected &&
    Boolean(connectedAddress) &&
    (!authenticatedAddress || connectedAddress !== authenticatedAddress);

  const refreshAuthState = useCallback(async () => {
    window.dispatchEvent(new Event("wallet-map-auth-changed"));
    router.refresh();
  }, [router]);

  const signIn = useCallback(async () => {
    setIsBusy(true);
    setError(null);

    try {
      if (!address || !isConnected) {
        throw new Error(t("wallet.connectFirst"));
      }

      const normalizedAddress = address.toLowerCase();
      const challengeResponse = await fetch("/api/auth/challenge", { method: "POST" });
      const challenge = await readJsonResponse<{ message?: string; error?: string }>(challengeResponse);

      if (!challengeResponse.ok || !challenge.message) {
        throw new Error(challenge.error ?? t("wallet.challengeFailed"));
      }

      const signature = await signMessageAsync({ message: challenge.message });
      const loginResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, message: challenge.message, signature }),
      });
      const login = await readJsonResponse<{ error?: string }>(loginResponse);

      if (!loginResponse.ok) {
        throw new Error(login.error ?? t("wallet.loginFailed"));
      }

      autoSignAttemptRef.current = normalizedAddress;
      await refreshAuthState();
    } catch (caught) {
      if (address) {
        autoSignAttemptRef.current = address.toLowerCase();
      }
      setError(caught instanceof Error ? caught.message : t("wallet.loginFailed"));
    } finally {
      setIsBusy(false);
    }
  }, [address, isConnected, refreshAuthState, signMessageAsync, t]);

  useEffect(() => {
    if (!needsWalletSignIn || isBusy || !connectedAddress) {
      return;
    }

    if (autoSignAttemptRef.current === connectedAddress) {
      return;
    }

    autoSignAttemptRef.current = connectedAddress;
    void signIn();
  }, [connectedAddress, isBusy, needsWalletSignIn, signIn]);

  async function retrySignIn() {
    if (!connectedAddress) {
      return;
    }

    autoSignAttemptRef.current = null;
    await signIn();
  }

  async function disconnect() {
    setIsBusy(true);
    setError(null);
    autoSignAttemptRef.current = null;

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      await disconnectAsync().catch(() => undefined);
      await refreshAuthState();
    } finally {
      setIsBusy(false);
    }
  }

  function renderSignedInChip() {
    return (
      <span
        className="headerChip headerChipOk walletHeaderSignedChip"
        title={ensName && displayAddress ? displayAddress : undefined}
      >
        <CheckCircle2 size={14} aria-hidden="true" />
        {t("wallet.signedIn")} {displayName ?? displayAddress}
      </span>
    );
  }

  return (
    <div className="walletHeaderControl">
      {!authLoaded ? (
        <span className="headerChip walletHeaderLoadingChip" aria-busy="true">
          {t("wallet.loading")}
        </span>
      ) : hasServerSession && isWalletRestoring ? (
        <span className="headerChip walletHeaderLoadingChip" aria-busy="true">
          {t("wallet.loading")}
        </span>
      ) : hasServerSession && (!isConnected || walletMatchesSession) ? (
        <>
          {renderSignedInChip()}
          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  className="walletHeaderButton"
                  type="button"
                  onClick={openConnectModal}
                  disabled={!mounted || isBusy}
                >
                  <Wallet size={14} aria-hidden="true" />
                  {t("wallet.reconnect")}
                </button>
              )}
            </ConnectButton.Custom>
          ) : null}
          <button className="walletHeaderIconButton" type="button" onClick={disconnect} disabled={isBusy} title={t("wallet.signOut")}>
            <LogOut size={15} aria-hidden="true" />
          </button>
        </>
      ) : isConnected && address ? (
        <>
          {isBusy ? (
            <span className="headerChip walletHeaderLoadingChip" aria-busy="true">
              <CheckCircle2 size={14} aria-hidden="true" />
              {t("wallet.waitingSignature")}
            </span>
          ) : error ? (
            <button
              className="walletHeaderButton walletHeaderButtonPrimary"
              type="button"
              onClick={() => void retrySignIn()}
              disabled={isBusy}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              {t("wallet.retrySignature")}
            </button>
          ) : (
            <span className="headerChip walletHeaderLoadingChip" aria-busy="true">
              <CheckCircle2 size={14} aria-hidden="true" />
              {t("wallet.readyToSignIn")}
            </span>
          )}
          <button className="walletHeaderIconButton" type="button" onClick={disconnect} disabled={isBusy} title={t("wallet.disconnect")}>
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
              {t("wallet.connect")}
            </button>
          )}
        </ConnectButton.Custom>
      )}
      {error ? <span className="walletHeaderError">{error}</span> : null}
    </div>
  );
}
