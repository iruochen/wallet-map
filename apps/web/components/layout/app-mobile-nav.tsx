"use client";

import { History, LayoutGrid, Tags } from "lucide-react";
import Link from "next/link";
import { useI18n } from "../i18n/i18n-provider";

export interface AppMobileNavProps {
  activeNav: "workbench" | "history" | "labels";
  labelsEnabled?: boolean;
}

export function AppMobileNav({ activeNav, labelsEnabled = false }: AppMobileNavProps) {
  const { t } = useI18n();

  return (
    <nav className="appMobileNav" aria-label={t("app.nav.main")}>
      <Link
        className={`appMobileNavLink ${activeNav === "workbench" ? "appMobileNavLinkActive" : ""}`}
        href="/"
      >
        <LayoutGrid size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>{t("app.nav.workbench")}</span>
      </Link>
      <Link
        className={`appMobileNavLink ${activeNav === "history" ? "appMobileNavLinkActive" : ""}`}
        href="/history"
      >
        <History size={18} strokeWidth={2.2} aria-hidden="true" />
        <span>{t("app.nav.history")}</span>
      </Link>
      {labelsEnabled ? (
        <Link
          className={`appMobileNavLink ${activeNav === "labels" ? "appMobileNavLinkActive" : ""}`}
          href="/labels"
        >
          <Tags size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>{t("app.nav.labels")}</span>
        </Link>
      ) : null}
    </nav>
  );
}
