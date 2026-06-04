import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import { AppProviders } from "./providers";
import "./styles.css";

export const metadata: Metadata = {
  title: "Wallet Map",
  description: "Local-first wallet relationship analysis toolkit.",
  icons: {
    shortcut: "/favicon.ico",
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
