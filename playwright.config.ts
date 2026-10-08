import { defineConfig, devices } from "@playwright/test";
const isolated = process.env.CRM_CHECK_ISOLATED === "1";
const baseURL = isolated ? "http://127.0.0.1:3109" : "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  preserveOutput: "never",
  use: {
    baseURL,
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      channel: process.env.PLAYWRIGHT_CHANNEL,
    },
  }],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${isolated ? 3109 : 3000}`,
    url: baseURL,
    reuseExistingServer: !isolated && !process.env.CI,
    timeout: 60_000,
  },
});
