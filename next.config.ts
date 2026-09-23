import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // axe-core and playwright must stay native at runtime: axe_audit.ts uses
  // require.resolve("axe-core") to locate the injectable bundle, and
  // playwright drives a real Chromium binary.
  serverExternalPackages: ["axe-core", "playwright"],
};

export default nextConfig;
