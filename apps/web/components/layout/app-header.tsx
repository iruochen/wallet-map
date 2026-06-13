import Link from "next/link";
import { WalletHeaderControls } from "./wallet-header-controls";

export interface AppHeaderProps {
  subtitle: string;
  activeNav: "workbench" | "history" | "labels";
  labelsEnabled?: boolean;
}

export function AppHeader({ subtitle, activeNav, labelsEnabled = false }: AppHeaderProps) {
  return (
    <header className="appHeader" aria-label="Wallet Map header">
      <Link className="appBrand" href="/" aria-label="返回工作台首页">
        <span className="appBrandMark" aria-hidden="true">
          WM
        </span>
        <div className="appBrandText">
          <strong>Wallet Map</strong>
          <span>{subtitle}</span>
        </div>
      </Link>
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
          {labelsEnabled ? (
            <Link
              className={`headerNavLink ${activeNav === "labels" ? "headerNavLinkActive" : ""}`}
              href="/labels"
            >
              标签库
            </Link>
          ) : null}
        </nav>
        <WalletHeaderControls />
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
