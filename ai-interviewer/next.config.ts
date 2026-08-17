import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // pdf-parse / mammoth are Node-only
  serverExternalPackages: ["pdf-parse", "mammoth"],
};

export default nextConfig;
