import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "client-modal-local.spec.ts", workers: 1, reporter: "list", preserveOutput: "never",
  use: { baseURL: "http://127.0.0.1:3112", screenshot: "off", video: "off", trace: "off",
    ...devices["Desktop Chrome"], channel: "chrome" },
});
