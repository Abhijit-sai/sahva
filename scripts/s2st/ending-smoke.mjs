import { chromium } from "@playwright/test";
import { installSyntheticMicrophone } from "../qa-microphone.mjs";
import { loadRecording } from "./audio.ts";
import assert from "node:assert/strict";

const fixture = process.argv[2];
const [engine="gemini",source="en",target="te"]=process.argv.slice(3);
if (!fixture) throw Error("Pass a synthetic WAV and optionally engine, source and target");
const durationMs = (await loadRecording(fixture)).length / 32;
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  await installSyntheticMicrophone(page, fixture);
  await page.goto("http://127.0.0.1:19752/");
  await page.selectOption("#direction", source);
  await page.selectOption("#language", target);
  await page.selectOption("#engine", engine);
  await page.click("#start");
  await page.locator("#finish").waitFor();
  await page.evaluate(() => window.qaSpeak());
  await page.waitForTimeout(durationMs + 200);
  await page.click("#finish");
  assert.equal(await page.evaluate(() => window.qaTracks()), 0);
  await page.getByText("Trial complete", { exact: true }).waitFor();
  assert.ok(await page.locator("#replay").isEnabled());
  const delay = await page.locator("#endLatency").innerText();
  assert.match(delay, /\d+\.\d+ s/);
  const caption = await page.locator("#target").innerText();
  console.log(
    "Released microphone, finished playback scheduling, enabled replay.",
  );
  console.log(
    "End delay",
    delay,
    "· synthetic fixture caption ending",
    caption.slice(-90),
  );
  await page.click("#replay");
} finally {
  await browser.close();
}
