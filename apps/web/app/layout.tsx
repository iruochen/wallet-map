import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
