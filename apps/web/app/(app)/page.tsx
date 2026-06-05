import { Suspense } from "react";
import { AnalysisWorkbench } from "../../components/analysis/analysis-workbench";
import { readLiveConfigured } from "../../components/layout/app-header";
import { supportedAnalysisChains } from "../chains";

export default function HomePage() {
  const liveConfigured = readLiveConfigured();
  const initialAddresses = readInitialAddresses();

  return (
    <Suspense fallback={<WorkbenchLoadingFallback />}>
      <AnalysisWorkbench
        liveConfigured={liveConfigured}
        supportedChains={supportedAnalysisChains}
        initialAddresses={initialAddresses}
      />
    </Suspense>
  );
}

function WorkbenchLoadingFallback() {
  return (
    <section className="workbench workbenchLoadingShell" aria-label="正在加载工作台">
      <div className="workbenchColumn workbenchInput">
        <div className="routeLoadingPanel">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="workbenchColumn workbenchGraph">
        <div className="routeLoadingPanel">
          <span />
          <span />
        </div>
      </div>
      <div className="workbenchColumn workbenchFindings">
        <div className="routeLoadingPanel">
          <span />
          <span />
        </div>
      </div>
    </section>
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
