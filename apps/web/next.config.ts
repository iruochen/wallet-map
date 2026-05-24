import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@wallet-map/core",
    "@wallet-map/adapters",
    "@wallet-map/analyzers",
    "@wallet-map/exporters",
  ],
};

export default nextConfig;
