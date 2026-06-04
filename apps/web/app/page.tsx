import Link from "next/link";
import { Suspense } from "react";
import { AnalysisWorkbench } from "../components/analysis/analysis-workbench";
import { AppHeader, readLiveConfigured } from "../components/layout/app-header";
import { supportedAnalysisChains } from "./chains";

export default function HomePage() {
  const liveConfigured = readLiveConfigured();
  const initialAddresses = readInitialAddresses();

  return (
    <div className="appShell">
      <AppHeader
        subtitle="钱包关联分析工作台"
        activeNav="workbench"
        liveConfigured={liveConfigured}
      />

      <main className="appMain">
        <Suspense fallback={<div className="workbenchLoadingFallback">正在加载工作台…</div>}>
          <AnalysisWorkbench
            liveConfigured={liveConfigured}
            supportedChains={supportedAnalysisChains}
            initialAddresses={initialAddresses}
          />
        </Suspense>
      </main>
    </div>
  );
}

function readInitialAddresses(): string | undefined {
  const raw = process.env.WALLET_MAP_DEFAULT_ADDRESSES?.trim();

  if (!raw) {
    return undefined;
  }

  return raw
    .split(/[,\s]+/)
    .map((address) => address.trim())
    .filter(Boolean)
    .join("\n");
}
