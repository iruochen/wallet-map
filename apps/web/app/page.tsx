import Link from "next/link";
import { Suspense } from "react";
import { AnalysisWorkbench } from "../components/analysis/analysis-workbench";
import { supportedAnalysisChains } from "./chains";

export default function HomePage() {
  const liveConfigured = Boolean(
    process.env.NODEREAL_API_KEY?.trim() ||
      process.env.NODEREAL_BSC_API_KEY?.trim() ||
      process.env.ETHERSCAN_API_KEY?.trim() ||
      process.env.SOLSCAN_API_KEY?.trim(),
  );
  const initialAddresses = readInitialAddresses();

  return (
    <div className="appShell">
      <header className="appHeader" aria-label="Wallet Map header">
        <div className="appBrand">
          <span className="appBrandMark" aria-hidden="true">
            WM
          </span>
          <div className="appBrandText">
            <strong>Wallet Map</strong>
            <span>钱包关联分析工作台</span>
          </div>
        </div>
        <div className="appHeaderStatus">
          <nav className="appHeaderNav" aria-label="主导航">
            <Link className="headerNavLink headerNavLinkActive" href="/">
              工作台
            </Link>
            <Link className="headerNavLink" href="/history">
              历史分析
            </Link>
          </nav>
          <span className={`headerChip ${liveConfigured ? "headerChipOk" : "headerChipMuted"}`}>
            <span className="headerChipDot" aria-hidden="true" />
            {liveConfigured ? "Live data ready" : "Fixture fallback"}
          </span>
        </div>
      </header>

      <Suspense fallback={<div className="workbenchLoadingFallback">正在加载工作台…</div>}>
        <AnalysisWorkbench
          liveConfigured={liveConfigured}
          supportedChains={supportedAnalysisChains}
          initialAddresses={initialAddresses}
        />
      </Suspense>
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
