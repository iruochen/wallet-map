import Link from "next/link";

export interface AppHeaderProps {
  subtitle: string;
  activeNav: "workbench" | "history";
  liveConfigured: boolean;
}

export function AppHeader({ subtitle, activeNav, liveConfigured }: AppHeaderProps) {
  return (
    <header className="appHeader" aria-label="Wallet Map header">
      <div className="appBrand">
        <span className="appBrandMark" aria-hidden="true">
          WM
        </span>
        <div className="appBrandText">
          <strong>Wallet Map</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="appHeaderStatus">
        <nav className="appHeaderNav" aria-label="主导航">
          <Link
            className={`headerNavLink ${activeNav === "workbench" ? "headerNavLinkActive" : ""}`}
            href="/"
          >
            工作台
          </Link>
          <Link
            className={`headerNavLink ${activeNav === "history" ? "headerNavLinkActive" : ""}`}
            href="/history"
          >
            历史分析
          </Link>
        </nav>
        <span className={`headerChip ${liveConfigured ? "headerChipOk" : "headerChipMuted"}`}>
          <span className="headerChipDot" aria-hidden="true" />
          {liveConfigured ? "Live data ready" : "Fixture fallback"}
        </span>
      </div>
    </header>
  );
}

export function readLiveConfigured(): boolean {
  return Boolean(
    process.env.NODEREAL_API_KEY?.trim() ||
      process.env.NODEREAL_BSC_API_KEY?.trim() ||
      process.env.ETHERSCAN_API_KEY?.trim() ||
      process.env.SOLSCAN_API_KEY?.trim(),
  );
}
