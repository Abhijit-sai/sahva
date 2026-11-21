// Runs a real paid-provider smoke on synthetic QA fixtures. Pass the directory produced by synthetic-speech-proof.ts.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

const fixtures = process.argv[2];
if (!fixtures) throw Error("Pass the synthetic WAV fixture directory.");
const origin = process.env.SAHVA_SMOKE_ORIGIN || "http://127.0.0.1:3018";
const temp = await mkdtemp(join(tmpdir(), "sahva-live-"));
const browsers = [];
async function participant(language) {
  const file = join(temp, language + ".wav");
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      resolve(fixtures, language + ".wav"),
      "-af",
      "adelay=700:all=1,apad=pad_dur=4",
      "-ar",
      "48000",
      "-ac",
      "1",
      file,
    ],
    { windowsHide: true },
  );
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--use-file-for-fake-audio-capture=" + file,
    ],
  });
  browsers.push(browser);
  return browser.newPage({ permissions: ["microphone"] });
}
try {
  const a = await participant("telugu"),
    b = await participant("english");
  await a.goto(origin);
  await a.getByLabel("Your name").fill("Telugu speaker");
  await a.getByLabel("Speak in").selectOption("te-IN");
  await a.getByLabel("Listen in").selectOption("te-IN");
  await a.getByRole("checkbox").check();
  await a.getByRole("button", { name: "Agree & create room" }).click();
  const invite = await a.getByLabel("Invitation link").inputValue();
  await b.goto(invite);
  await b.getByLabel("Your name").fill("English speaker");
  await b.getByRole("checkbox").check();
  await b.getByRole("button", { name: "Agree & join" }).click();
  for (const p of [a, b])
    await p.getByRole("button", { name: "Enable incoming voice" }).click();
  for (const [index, [speaker, listener, source, target]] of [
    [a, b, "te-IN", "en-IN"],
    [b, a, "en-IN", "te-IN"],
  ].entries()) {
    const start = Date.now();
    let finishAt = 0;
    speaker.on("request", (req) => {
      if (req.url().endsWith("/live/finish") && !finishAt)
        finishAt = Date.now();
    });
    await speaker.getByRole("button", { name: "Speak live" }).click();
    const partial = listener
      .locator('.live-caption[data-has-speech="true"]')
      .filter({ hasText: /speaker · Live caption/ })
      .locator("p");
    await partial
      .filter({ hasText: /[\p{L}]{2}/u })
      .waitFor({ timeout: 20000 });
    const captionMs = Date.now() - start;
    await listener.getByText(/Draft translation/).waitFor({ timeout: 18000 });
    const draftMs = Date.now() - start;
    if (index === 0 && process.env.SAHVA_SMOKE_SCREENSHOT)
      await listener
        .locator(".live-box")
        .screenshot({ path: process.env.SAHVA_SMOKE_SCREENSHOT });
    const card = listener.locator("article[id^=turn-]").nth(index);
    await card.locator("audio").nth(1).waitFor({ timeout: 45000 });
    await listener
      .getByText("Playing voice", { exact: true })
      .waitFor({ timeout: 15000 });
    const played = Date.now() - start;
    assert.equal(
      await speaker.getByRole("button", { name: "Finish phrase" }).count(),
      0,
    );
    const room = new URL(invite).pathname.split("/").pop();
    const api = origin + "/api/v1/rooms/" + room;
    const turns = (await (await listener.request.get(api + "/timeline")).json())
      .turns;
    assert.equal(turns[index].source, source);
    assert.equal(turns[index].target, target);
    const original = await listener.request.get(
      api + "/media/" + turns[index].id + "?kind=original",
    );
    const wav = await original.body();
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.ok(wav.length > 16000);
    console.log(
      JSON.stringify({
        source,
        target,
        captionMs,
        draftMs,
        autoPlaybackMs: played,
        finishRequestToPlaybackMs: finishAt ? start + played - finishAt : null,
        originalMs: turns[index].duration_ms,
      }),
    );
    await listener
      .getByText("Playing voice", { exact: true })
      .waitFor({ state: "hidden", timeout: 20000 });
  }
  const roomApi =
    origin + "/api/v1/rooms/" + new URL(invite).pathname.split("/").pop();
  const headers = { "x-sahva-request": "1" };
  const opened = await a.request.post(roomApi + "/live/start", {
    headers,
    data: {},
  });
  assert.equal(opened.status(), 200);
  const { key } = await opened.json();
  const foreign = await b.request.post(roomApi + "/live/finish", {
    headers,
    data: { key },
  });
  assert.equal(foreign.status(), 409);
  assert.equal(
    (await a.request.post(roomApi + "/end", { headers, data: {} })).status(),
    409,
  );
  await b.getByRole("button", { name: "Withdraw consent" }).click();
  await a
    .getByText("Recording requires two consenting participants.")
    .waitFor();
  assert.equal(
    (
      await a.request.post(roomApi + "/live/frame", {
        headers,
        data: { key, seq: 0, audio: "AAAAAA==" },
      })
    ).status(),
    409,
  );
  assert.equal(
    (await (await a.request.get(roomApi + "/timeline")).json()).caption,
    null,
  );
  await b.getByRole("button", { name: "Consent again" }).click();
  await a.getByRole("button", { name: "Speak live" }).waitFor();
  await a.getByRole("button", { name: "End room" }).click();
  await a.locator(".citation").first().waitFor({ timeout: 100000 });
  await b.locator(".citation").first().waitFor({ timeout: 20000 });
  assert.equal(await a.getByLabel("Report language").inputValue(), "te-IN");
  assert.equal(await b.getByLabel("Report language").inputValue(), "en-IN");
  console.log(
    "Two live phrases, partial captions, draft translation, automatic incoming playback, original persistence and both localized reports passed.",
  );
} finally {
  for (const b of browsers) await b.close();
  await rm(temp, { recursive: true, force: true });
}
