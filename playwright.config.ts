import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:
    process.env.SAHVA_LIVE_QA === "1" ? "./tests/live" : "./tests/browser",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3231",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3231",
    url: "http://127.0.0.1:3231",
    env: {
      SAHVA_LOCAL: "1",
      SAHVA_TEST_RUN: String(Date.now()),
      SAHVA_OFFLINE_TEST: process.env.SAHVA_LIVE_QA === "1" ? "0" : "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    timeout: 90000,
    reuseExistingServer: false,
  },
});
