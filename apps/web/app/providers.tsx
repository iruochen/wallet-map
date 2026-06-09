"use client";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "wagmi/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "wallet-map-local";

const walletConfig = getDefaultConfig({
  appName: "Wallet Map",
  projectId: walletConnectProjectId,
  chains: [mainnet, arbitrum, base, optimism, polygon, bsc],
  ssr: true,
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    function isWalletExtensionError(value: unknown): boolean {
      if (!value) {
        return false;
      }

      let text: string;

      try {
        text = value instanceof Error
          ? `${value.message}\n${value.stack ?? ""}`
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
      } catch {
        text = String(value);
      }

      return text.includes("chrome-extension://");
    }

    function handleError(event: ErrorEvent) {
      if (event.filename?.startsWith("chrome-extension://") || isWalletExtensionError(event.error)) {
        event.preventDefault();
      }
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (isWalletExtensionError(event.reason)) {
        event.preventDefault();
      }
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <WagmiProvider config={walletConfig} reconnectOnMount>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
