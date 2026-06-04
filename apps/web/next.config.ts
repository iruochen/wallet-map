import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: [
    "@wallet-map/core",
    "@wallet-map/adapters",
    "@wallet-map/analyzers",
    "@wallet-map/exporters",
    "@wallet-map/labels",
    "@wallet-map/storage",
  ],
};

export default nextConfig;
