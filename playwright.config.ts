import { defineConfig } from "@playwright/test";
const localMedia = process.env.SAHVA_RTC_TEST === "1";
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
      ...(process.env.SAHVA_LIVE_QA === "1"
        ? {}
        : {
            SAHVA_LIVEKIT: "1",
            LIVEKIT_URL: localMedia ? "ws://127.0.0.1:17880" : "ws://127.0.0.1:1",
            SAHVA_LIVE_MEDIA_INTERPRETATION: localMedia ? "1" : "0",
            LIVEKIT_API_KEY: localMedia ? "devkey" : "offline-test",
            LIVEKIT_API_SECRET: localMedia ? "secret" : "offline-test-only",
          }),
      NEXT_TELEMETRY_DISABLED: "1",
    },
    timeout: 90000,
    reuseExistingServer: false,
  },
});
