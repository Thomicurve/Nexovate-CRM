import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: ".", testMatch: "client-delete-local.spec.ts", workers: 1, reporter: "list", preserveOutput: "never", timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3117", ...devices["Desktop Chrome"], channel: "chrome", screenshot: "off", video: "off", trace: "off" } });
