import { DirectTransferAnalyzer } from "@wallet-map/analyzers";
import { AnalysisWorkbench } from "./analysis-workbench";
import { supportedAnalysisChains } from "./chains";

const analyzer = new DirectTransferAnalyzer();

export default function HomePage() {
  const liveConfigured = Boolean(process.env.ETHERSCAN_API_KEY?.trim());
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
          <span className={`headerChip ${liveConfigured ? "headerChipOk" : "headerChipMuted"}`}>
            <span className="headerChipDot" aria-hidden="true" />
            {liveConfigured ? "Live data ready" : "Fixture fallback"}
          </span>
          <span className="headerChip headerChipMuted">
            Analyzer · {analyzer.name}
          </span>
        </div>
      </header>

      <AnalysisWorkbench
        liveConfigured={liveConfigured}
        supportedChains={supportedAnalysisChains}
        initialAddresses={initialAddresses}
      />
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
