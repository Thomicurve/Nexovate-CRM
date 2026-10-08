import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  // A fixed, local check directory keeps production checks off the user's dev build.
  ...(process.env.CRM_CHECK_ISOLATED === "1" ? { distDir: ".next-task009" } : {}),
};

export default nextConfig;
