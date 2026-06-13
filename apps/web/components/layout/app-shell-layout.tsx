"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";

const labelsEnabled = process.env.NEXT_PUBLIC_LABEL_MANAGER_ENABLED === "true";

const shellConfig = {
  "/": {
    subtitle: "钱包关联分析工作台",
    activeNav: "workbench" as const,
  },
  "/history": {
    subtitle: "历史分析记录",
    activeNav: "history" as const,
  },
  "/labels": {
    subtitle: "本地标签库管理",
    activeNav: "labels" as const,
  },
};

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const config =
    pathname === "/history"
      ? shellConfig["/history"]
      : pathname === "/labels"
        ? shellConfig["/labels"]
        : shellConfig["/"];

  return (
    <div className="appShell">
      <AppHeader
        subtitle={config.subtitle}
        activeNav={config.activeNav}
        labelsEnabled={labelsEnabled}
      />
      <main className="appMain">{children}</main>
    </div>
  );
}
