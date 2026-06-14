"use client";

import Link from "next/link";
import { LanguageSwitch } from "../i18n/language-switch";
import { useI18n } from "../i18n/i18n-provider";
import { WalletHeaderControls } from "./wallet-header-controls";

export interface AppHeaderProps {
  subtitle: string;
  activeNav: "workbench" | "history" | "labels";
  labelsEnabled?: boolean;
}

export function AppHeader({ subtitle, activeNav, labelsEnabled = false }: AppHeaderProps) {
  const { t } = useI18n();

  return (
    <header className="appHeader" aria-label={t("app.header.aria")}>
      <Link className="appBrand" href="/" aria-label={t("app.header.homeAria")}>
        <span className="appBrandMark" aria-hidden="true">
          WM
        </span>
        <div className="appBrandText">
          <strong>Wallet Map</strong>
          <span>{subtitle}</span>
        </div>
      </Link>
      <div className="appHeaderStatus">
        <nav className="appHeaderNav appHeaderNavDesktop" aria-label={t("app.nav.main")}>
          <Link
            className={`headerNavLink ${activeNav === "workbench" ? "headerNavLinkActive" : ""}`}
            href="/"
          >
            {t("app.nav.workbench")}
          </Link>
          <Link
            className={`headerNavLink ${activeNav === "history" ? "headerNavLinkActive" : ""}`}
            href="/history"
          >
            {t("app.nav.history")}
          </Link>
          {labelsEnabled ? (
            <Link
              className={`headerNavLink ${activeNav === "labels" ? "headerNavLinkActive" : ""}`}
              href="/labels"
            >
              {t("app.nav.labels")}
            </Link>
          ) : null}
        </nav>
        <LanguageSwitch />
        <WalletHeaderControls />
      </div>
    </header>
  );
}
