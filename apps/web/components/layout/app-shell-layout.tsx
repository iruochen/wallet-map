"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";

const shellConfig = {
  "/": {
    subtitle: "钱包关联分析工作台",
    activeNav: "workbench" as const,
  },
  "/history": {
    subtitle: "历史分析记录",
    activeNav: "history" as const,
  },
};

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const config = pathname === "/history" ? shellConfig["/history"] : shellConfig["/"];

  return (
    <div className="appShell">
      <AppHeader subtitle={config.subtitle} activeNav={config.activeNav} />
      <main className="appMain">{children}</main>
    </div>
  );
}
