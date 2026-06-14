"use client";

import { usePathname } from "next/navigation";
import { useI18n, type I18nKey } from "../i18n/i18n-provider";
import { AppHeader } from "./app-header";
import { AppMobileNav } from "./app-mobile-nav";

const labelsEnabled = process.env.NEXT_PUBLIC_LABEL_MANAGER_ENABLED === "true";

const shellConfig: Record<
  "/history" | "/labels" | "/",
  { subtitleKey: I18nKey; activeNav: "workbench" | "history" | "labels" }
> = {
  "/": {
    subtitleKey: "app.subtitle.workbench",
    activeNav: "workbench" as const,
  },
  "/history": {
    subtitleKey: "app.subtitle.history",
    activeNav: "history" as const,
  },
  "/labels": {
    subtitleKey: "app.subtitle.labels",
    activeNav: "labels" as const,
  },
};

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const config =
    pathname === "/history"
      ? shellConfig["/history"]
      : pathname === "/labels"
        ? shellConfig["/labels"]
        : shellConfig["/"];

  return (
    <div className="appShell">
      <AppHeader
        subtitle={t(config.subtitleKey)}
        activeNav={config.activeNav}
        labelsEnabled={labelsEnabled}
      />
      <main className="appMain">{children}</main>
      <AppMobileNav activeNav={config.activeNav} labelsEnabled={labelsEnabled} />
    </div>
  );
}
