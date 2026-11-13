import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app lives in a subfolder of a repo that has its own lockfile at the root.
  // Pin file tracing to this folder so Next.js doesn't treat the repo root as the workspace.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
