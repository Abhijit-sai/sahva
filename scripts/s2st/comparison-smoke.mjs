import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:19752/");
  await page.getByText("Ready", { exact: true }).waitFor();
  await page.selectOption("#direction", "en");
  await page.selectOption("#language", "te");
  assert.equal(await page.locator("#engine option[value=openai]").count(), 0);
  await page.selectOption("#language", "hi");
  await page.selectOption("#input", "en-corrections");
  await page.locator("#choices input[value=openai]").check();
  await page.locator("#choices input[value=gemini]").check();
  for (const other of await page
    .locator("#choices input:not([value=openai]):not([value=gemini])")
    .all())
    await other.uncheck();
  await page.click("#compare");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("#results article").length === 2 &&
      !document.querySelector("#start").disabled,
    null,
    { timeout: 95000 },
  );
  assert.equal(await page.locator("#results audio").count(), 4);
  await page.locator("#results details").first().locator("summary").click();
  await page.locator("#results details select").first().selectOption("3");
  const download = page.waitForEvent("download");
  await page.click("#download");
  const file = await (await download).path();
  const rows = JSON.parse(await readFile(file, "utf8"));
  assert.equal(rows[0].sha256, rows[1].sha256);
  assert.ok(
    rows.every(
      (r) =>
        !r.error && r.metrics.firstVoicedPlayback > 0 && r.transcripts.target,
    ),
  );
  assert.equal(rows[1].review.Meaning, 3);
  assert.deepEqual(errors, []);
  console.log(
    rows.map((r) => ({
      engine: r.engine,
      firstPlaybackMs: r.metrics.firstVoicedPlayback,
      endToLastMs: r.metrics.endToLastPlayback,
      hash: r.sha256.slice(0, 12),
    })),
  );
} finally {
  await browser.close();
}
