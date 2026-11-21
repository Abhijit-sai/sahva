// The QA driver supplies synthetic waveforms only at the microphone boundary.
// Both browsers run the actual room UI, speech gate, streaming APIs, playback and report.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
const fixtures = process.argv[2];
if (!fixtures) throw Error("Pass the synthetic WAV fixture directory.");
const origin = process.env.SAHVA_SMOKE_ORIGIN || "http://127.0.0.1:3018";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function seat(wav) {
  const page = await browser.newPage();
  await page.addInitScript(
    (base64) => {
      const tracks = [];
      let audio, clip, output;
      navigator.mediaDevices.getUserMedia = async () => {
        audio ??= new AudioContext();
        await audio.resume();
        clip ??= await audio.decodeAudioData(
          Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer,
        );
        output = audio.createMediaStreamDestination();
        tracks.push(...output.stream.getAudioTracks());
        return output.stream;
      };
      window.qaTracks = () =>
        tracks.filter((t) => t.readyState === "live").length;
      window.qaSpeak = async (seconds) => {
        await audio.resume();
        const source = audio.createBufferSource();
        source.buffer = clip;
        source.connect(output);
        source.start(0, 0, seconds ?? clip.duration);
      };
    },
    (await readFile(join(fixtures, wav))).toString("base64"),
  );
  return page;
}
const click = (p, name) => p.getByRole("button", { name, exact: true }).click();
try {
  const a = await seat("telugu.wav"),
    b = await seat("english.wav");
  await a.goto(origin);
  await a.getByLabel("Your name").fill("Anu");
  await a.getByLabel("Speak in").selectOption("te-IN");
  await a.getByLabel("Listen in").selectOption("te-IN");
  await a.getByRole("checkbox").check();
  await click(a, "Agree & create room");
  const invite = await a.getByLabel("Invitation link").inputValue();
  await b.goto(invite);
  await b.getByLabel("Your name").fill("Sam");
  await b.getByRole("checkbox").check();
  await click(b, "Agree & join");
  const api =
    origin + "/api/v1/rooms/" + new URL(invite).pathname.split("/").pop();
  let starts = 0,
    finishAt = 0;
  for (const p of [a, b]) {
    p.on("request", (req) => {
      if (req.url().endsWith("/live/start")) starts++;
      if (req.url().endsWith("/live/finish")) finishAt = Date.now();
    });
    await click(p, "Start hands-free");
    await p
      .getByRole("button", { name: "Mute microphone", exact: true })
      .waitFor();
  }
  await sleep(1200);
  assert.equal(starts, 0);
  await a.getByLabel(/Using headphones/).check();
  let interruptedAt;
  for (let i = 0; i < 4; i++) {
    const speaker = i % 2 ? b : a,
      listener = i % 2 ? a : b;
    let start;
    if (i === 2) {
      start = interruptedAt;
    } else {
      await sleep(950);
      start = Date.now();
      await speaker.evaluate(() => window.qaSpeak());
    }
    await listener
      .locator('.live-caption[data-has-speech="true"]')
      .waitFor({ timeout: 18000 });
    const captionMs = Date.now() - start;
    await listener.getByText(/Draft translation/).waitFor({ timeout: 18000 });
    await listener
      .getByText("Playing voice", { exact: true })
      .waitFor({ timeout: 50000 });
    assert.ok(finishAt >= start);
    const finishToPlaybackMs = Date.now() - finishAt;
    const data = await (await listener.request.get(api + "/timeline")).json();
    assert.equal(data.turns.length, i + 1);
    const turn = data.turns[i];
    assert.equal(turn.source, i % 2 ? "en-IN" : "te-IN");
    assert.equal(turn.voice, true);
    const original = await listener.request.get(
      api + "/media/" + turn.id + "?kind=original",
    );
    assert.equal((await original.body()).toString("ascii", 0, 4), "RIFF");
    if (i === 0) {
      // Simulated speaker bleed while the receiver is playing incoming audio.
      await listener.evaluate(() => window.qaSpeak(0.8));
    }
    if (i === 1) {
      // The receiver has opted in to hands-free interruption with headphones.
      await sleep(350);
      await listener.getByText("Playing voice", { exact: true }).waitFor();
      const bargeIn = listener.waitForRequest(
        (req) => req.url().endsWith("/live/start"),
        { timeout: 2500 },
      );
      interruptedAt = Date.now();
      await listener.evaluate(() => window.qaSpeak());
      await bargeIn;
      await listener
        .getByText("Playing voice", { exact: true })
        .waitFor({ state: "hidden", timeout: 1200 });
    }
    if (i === 3) await click(listener, "Interrupt playback");
    await listener
      .getByText("Playing voice", { exact: true })
      .waitFor({ state: "hidden", timeout: 20000 });
    console.log(
      JSON.stringify({
        turn: i + 1,
        source: turn.source,
        captionMs,
        finishToPlaybackMs,
        originalMs: turn.duration_ms,
      }),
    );
  }
  assert.equal(starts, 4);
  const replay = a.locator("article audio").first();
  await replay.evaluate((audio) => audio.play());
  await a.evaluate(() => window.qaSpeak(1.4));
  await sleep(1900);
  assert.equal(starts, 4, "Archived audio must not turn into a new phrase.");
  await replay.evaluate((audio) => audio.pause());
  await click(a, "Mute microphone");
  assert.equal(await a.evaluate(() => window.qaTracks()), 0);
  await a.evaluate(() => window.qaSpeak(0.8));
  await sleep(1200);
  assert.equal(starts, 4);
  await click(a, "Start hands-free");
  await a
    .getByRole("button", { name: "Mute microphone", exact: true })
    .waitFor();
  await a.context().setOffline(true);
  await a.waitForFunction(() => window.qaTracks() === 0);
  await a.context().setOffline(false);
  await a
    .getByRole("button", { name: "Start hands-free", exact: true })
    .waitFor({ timeout: 10000 });
  await click(a, "Start hands-free");
  await a
    .getByRole("button", { name: "Mute microphone", exact: true })
    .waitFor();
  await click(b, "Withdraw consent");
  for (const p of [a, b])
    await p.waitForFunction(() => window.qaTracks() === 0);
  await click(b, "Consent again");
  await click(a, "End room");
  for (const p of [a, b])
    await p.locator(".citation").first().waitFor({ timeout: 100000 });
  assert.equal(
    (await (await a.request.get(api + "/timeline")).json()).turns.length,
    4,
  );
  assert.equal(await a.getByLabel("Report language").inputValue(), "te-IN");
  assert.equal(await b.getByLabel("Report language").inputValue(), "en-IN");
  console.log(
    "PASS: four alternating hands-free turns, silence, speaker bleed suppression, spoken and button interruptions, mute, offline/re-arm, consent shutdown and both reports.",
  );
} finally {
  await browser.close();
}
