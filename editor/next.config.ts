import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Avoid Next picking a parent lockfile as the monorepo root
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
