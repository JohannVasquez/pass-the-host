import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Electron app's lockfile lives one level up; keep this site self-contained
  turbopack: { root: __dirname },
};

export default nextConfig;
