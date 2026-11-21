import { chromium, type Browser } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { SarvamSpeech } from "../../lib/providers/sarvam.ts";
import { loadRecording, now, voicedBounds, wav } from "./audio.ts";
import { connect, model } from "./engines.ts";
import { listener } from "./listener.ts";

// Reuse the four independently transcribed synthetic quarter fixtures.
const paddedControl = process.argv[2] === "--padded-control";
const folders = process.argv.slice(paddedControl ? 3 : 2);
if (folders.length !== 2)
  throw Error("Pass the explicit and pronoun fixture directories");
const output = await mkdtemp(".sahva/ending-ab-");
console.log("Private evidence", output);
const recognizer = new SarvamSpeech(process.env.SARVAM_API_KEY ?? "");

async function trial(
  browser: Browser,
  pcm: Buffer,
  graceMs: number,
  label: string,
) {
  const lastInput = voicedBounds(pcm, 16000).last;
  if (lastInput === null) throw Error("Silent fixture");
  const page = await listener(browser, false);
  let playback = Promise.resolve();
  const audio: Buffer[] = [];
  const target: string[] = [];
  const source: string[] = [];
  let voiced = false,
    activity = 0;
  const session = await connect(
    "gemini",
    "en-IN",
    {
      audio(bytes) {
        audio.push(bytes);
        if (voicedBounds(bytes, 24000).first !== null) {
          voiced = true;
          activity = now();
        }
        playback = playback.then(() =>
          page.evaluate(
            (data) => window.s2stPlayer.play(data, "pcm"),
            bytes.toString("base64"),
          ),
        );
      },
      text(side, text) {
        if (!text) return;
        (side === "target" ? target : source).push(text);
        activity = now();
      },
      event(kind) {
        if (kind === "interrupted")
          playback = playback.then(() =>
            page.evaluate(() => window.s2stPlayer.interrupt()),
          );
      },
      usage() {},
    },
    {
      hintSourceLanguage: true,
      echoTargetLanguage: true,
      reportingPeriods: true,
    },
  );
  const captures = [];
  const padMs = paddedControl ? graceMs : 0;
  const sentHash = createHash("sha256");
  try {
    const start = now();
    const samples = Buffer.concat([pcm, Buffer.alloc(padMs * 32)]);
    for (let offset = 0; offset < samples.length; offset += 3200) {
      await wait(Math.max(0, start + offset / 32 - now()));
      const frame = samples.subarray(offset, offset + 3200);
      await session.feed(frame);
      sentHash.update(frame);
    }
    await wait(Math.max(0, start + samples.length / 32 - now()));
    if (graceMs && !padMs) await wait(graceMs);
    await session.finish();
    const end = now();
    // Nested cutoffs on one live response isolate the effect of waiting alone.
    for (const [quietMs, capMs] of [
      [4500, 15000],
      [8000, 20000],
    ]) {
      while (true) {
        session.check();
        const time = now();
        if (
          (voiced && time - Math.max(activity, end) >= quietMs) ||
          time - end >= capMs
        )
          break;
        await wait(100);
      }
      const statusMs = Math.round(now() - start - lastInput);
      const rendered = Buffer.concat(audio);
      const caption = target.join("");
      const inputCaption = source.join("");
      await playback;
      const mark = await page.evaluate(() => window.s2stPlayer.mark());
      const last = voicedBounds(rendered, 24000).last;
      if (!last || !mark.lastVoiced)
        throw Error("Missing spoken output " + label);
      const trimmed = rendered.subarray(0, Math.ceil((last * 48) / 2) * 2);
      const bytes = wav(Buffer.concat([trimmed, Buffer.alloc(33600)]), 24000);
      captures.push({
        quietMs,
        statusMs,
        playbackMs: Math.round(mark.lastVoiced - start - lastInput),
        caption,
        inputCaption,
        bytes,
      });
    }
  } finally {
    session.close();
    await playback;
    await page.close();
  }
  const transcripts = new Map<string, string>();
  const sentPcmSha256 = sentHash.digest("hex");
  for (const { bytes, ...capture } of captures) {
    const digest = createHash("sha256").update(bytes).digest("hex");
    const path = join(output, label + "-" + capture.quietMs);
    await writeFile(path + ".wav", bytes);
    const heard =
      transcripts.get(digest) ??
      (
        await recognizer.transcribe(
          new File([new Uint8Array(bytes)], "output.wav", {
            type: "audio/wav",
          }),
        )
      ).text;
    transcripts.set(digest, heard);
    await writeFile(
      path + ".json",
      JSON.stringify(
        {
          model,
          padMs,
          graceMs,
          sentPcmSha256,
          ...capture,
          heard,
          digest,
          inputHash: createHash("sha256").update(pcm).digest("hex"),
          fileTailMs: Math.round(pcm.length / 32 - lastInput),
        },
        null,
        2,
      ),
    );
  }
}

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  for (const round of [1, 2]) {
    for (const [index, folder] of folders.entries()) {
      for (const direction of ["previous", "current"]) {
        const file = join(folder, direction);
        const pcm = await loadRecording(file + ".wav");
        if (
          createHash("sha256").update(pcm).digest("hex") !==
          JSON.parse(await readFile(file + ".json", "utf8")).pcmSha256
        )
          throw Error("Fixture hash mismatch");
        const label = [index ? "pronoun" : "explicit", direction, round].join(
          "-",
        );
        const results = await Promise.allSettled(
          (round === 1 ? [0, 4000] : [4000, 0]).map((pad) =>
            trial(browser, pcm, pad, label + "-" + pad),
          ),
        );
        for (const result of results)
          if (result.status === "rejected") throw result.reason;
        console.log("Completed", label);
      }
    }
  }
} finally {
  await browser.close();
}
