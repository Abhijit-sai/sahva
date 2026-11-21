import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { connect, model, type Hooks } from "./engines.ts";
import { loadRecording, now, voicedBounds, wav } from "./audio.ts";
import { listener } from "./listener.ts";

const [engine, direction, input, consent, option] = process.argv.slice(2);
if (
  (engine !== "gemini" && engine !== "sarvam") ||
  !["te", "en", "both"].includes(direction) ||
  !input ||
  consent !== "--consented" ||
  (option &&
    !["--interrupt", "--disconnect-te", "--fixture-mic"].includes(option)) ||
  (option === "--fixture-mic" &&
    (direction === "both" || input === "mic" || engine !== "gemini")) ||
  (option === "--disconnect-te" &&
    (engine !== "gemini" || direction !== "both" || input === "mic")) ||
  (input === "mic" && (direction === "both" || engine !== "gemini"))
)
  throw Error(
    "Usage: run.ts <gemini|sarvam> <te|en|both> <fixture-directory|mic> --consented [--interrupt|--disconnect-te|--fixture-mic]",
  );
const selected = engine;
const fakeMic = option === "--fixture-mic";
const mic = input === "mic" || fakeMic;
await mkdir(".sahva", { recursive: true });
const root = await mkdtemp(".sahva/s2st-");
console.log("Private recording and measurements:", root);
const browser = await chromium.launch({
  channel: "chrome",
  headless: input !== "mic",
  args: [
    "--autoplay-policy=no-user-gesture-required",
    ...(fakeMic
      ? [
          "--use-fake-device-for-media-stream",
          "--use-fake-ui-for-media-stream",
          "--use-file-for-fake-audio-capture=" +
            resolve(input, direction === "te" ? "telugu.wav" : "english.wav") +
            "%noloop",
        ]
      : []),
  ],
});
async function trial(lang: "en" | "te") {
  const target = lang === "te" ? "en" : "te";
  const dir = join(root, lang);
  await mkdir(dir);
  const file = mic
    ? null
    : await loadRecording(
        join(input, lang === "te" ? "telugu.wav" : "english.wav"),
      );
  const page = await listener(browser, mic);
  const events: {
    kind: string;
    at: number;
    text?: string;
    final?: boolean;
    language?: string;
  }[] = [];
  const source: Buffer[] = [],
    output: Buffer[] = [];
  const usage: { at: number; value: Record<string, unknown> }[] = [];
  let lastActivity = 0,
    playbackFailure = false;
  let queue = Promise.resolve(),
    origin = now(),
    firstAudio: number | null = null,
    firstVoicedReceipt: number | null = null;
  let firstTranscript: number | null = null,
    stopOutput = false,
    inputBytes = 0;
  let queuedAudioMs = 0,
    cutTimer: ReturnType<typeof setTimeout> | undefined;
  const enqueue = (f: () => Promise<unknown>) => {
    queue = queue
      .then(f)
      .then(() => {})
      .catch(() => {
        playbackFailure = true;
      });
  };
  const hooks: Hooks = {
    text(side, text, final, language) {
      if (text) lastActivity = now();
      if (side === "source" && text) firstTranscript ??= now();
      events.push({ kind: side, at: now(), text, final, language });
      // Preserve provider pieces and revisions verbatim in the private journal.
      enqueue(() =>
        page.locator("#" + side).evaluate((el, line) => {
          el.append(document.createTextNode(line + " "));
        }, text),
      );
    },
    event(kind) {
      events.push({ kind, at: now() });
      if (kind === "interrupted")
        enqueue(() => page.evaluate(() => window.s2stPlayer.interrupt()));
    },
    usage(value) {
      usage.push({ at: now(), value });
    },
    audio(bytes, format) {
      output.push(bytes);
      firstAudio ??= now();
      if (format === "wav" || voicedBounds(bytes, 24000).first !== null) {
        firstVoicedReceipt ??= now();
        lastActivity = now();
      }
      if (stopOutput) return;
      if (format === "pcm") queuedAudioMs += bytes.length / 48;
      enqueue(() =>
        page.evaluate(([data, fmt]) => window.s2stPlayer.play(data, fmt), [
          bytes.toString("base64"),
          format,
        ] as const),
      );
      if (
        option === "--interrupt" &&
        !cutTimer &&
        (format === "wav" || queuedAudioMs >= 450)
      ) {
        cutTimer = setTimeout(() => {
          stopOutput = true;
          hooks.event("localPlaybackStop");
          enqueue(() => page.evaluate(() => window.s2stPlayer.interrupt()));
        }, 200);
      }
    },
  };
  let stream: Awaited<ReturnType<typeof connect>> | undefined;
  let failure: string | null = null;
  try {
    const opening = now();
    stream = await connect(selected, lang === "te" ? "te-IN" : "en-IN", hooks);
    events.push(
      { kind: "setupStarted", at: opening },
      { kind: "setupReady", at: now() },
    );
    const feed = async (frame: Buffer) => {
      if (inputBytes + frame.length > 800000)
        throw Error("Input exceeds 25 seconds");
      if (!inputBytes) origin = now();
      source.push(frame);
      inputBytes += frame.length;
      await stream!.feed(frame);
    };
    if (file) {
      const start = now();
      for (let offset = 0; offset < file.length; offset += 3200) {
        const frame = file.subarray(offset, offset + 3200);
        await delay(Math.max(0, start + offset / 32 - now()));
        if (option === "--disconnect-te" && lang === "te" && offset === 96000) {
          hooks.event("injectedDisconnect");
          stream.close();
        }
        await feed(frame);
      }
      await delay(Math.max(0, start + file.length / 32 - now()));
    } else {
      const done = Promise.withResolvers<void>();
      await page.exposeFunction("sendMic", async (data: string) => {
        try {
          const frame = Buffer.from(data, "base64");
          const remaining = 800000 - inputBytes;
          if (remaining > 0) await feed(frame.subarray(0, remaining));
        } catch {
          done.reject(Error("Microphone stream failed"));
        }
      });
      await page.exposeFunction("endMic", () => done.resolve());
      await page.evaluate(
        (workletSource) => {
          const btn = document.querySelector<HTMLButtonElement>("#mic")!;
          btn.onclick = async () => {
            btn.disabled = true;
            let audio: AudioContext | undefined,
              tracks: MediaStream | undefined;
            try {
              tracks = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true },
              });
              audio = new AudioContext({ sampleRate: 16000 });
              await audio.resume();
              const workletUrl = URL.createObjectURL(
                new Blob([workletSource], { type: "text/javascript" }),
              );
              try {
                await audio.audioWorklet.addModule(workletUrl);
              } finally {
                URL.revokeObjectURL(workletUrl);
              }
              const node = new AudioWorkletNode(audio, "demo-pcm");
              const flushed = Promise.withResolvers<void>();
              let tail = Promise.resolve();
              node.port.onmessage = (e) => {
                if (e.data === "finished") {
                  flushed.resolve();
                  return;
                }
                const bytes = new Uint8Array(e.data);
                for (let i = 0; i < bytes.length; i += 3200) {
                  const data = btoa(
                    String.fromCharCode(...bytes.subarray(i, i + 3200)),
                  );
                  tail = tail.then(() => window.sendMic(data));
                }
              };
              audio.createMediaStreamSource(tracks).connect(node);
              node.connect(audio.destination);
              await new Promise((resolve) => setTimeout(resolve, 25000));
              node.port.postMessage("finish");
              tracks.getTracks().forEach((track) => track.stop());
              await flushed.promise;
              node.port.onmessage = null;
              node.disconnect();
              await tail;
            } finally {
              tracks?.getTracks().forEach((t) => t.stop());
              await audio?.close();
              await window.endMic();
            }
          };
        },
        await readFile("scripts/s2st/demo-pcm.js", "utf8"),
      );
      const timeout = setTimeout(
        () => done.reject(Error("Microphone consent or capture timed out")),
        90000,
      );
      try {
        if (fakeMic) await page.locator("#mic").click();
        await done.promise;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!inputBytes) throw Error("No audio captured");
    await stream.finish();
    if (selected === "gemini") {
      const end = now();
      while (now() - end < 22000) {
        stream.check();
        if (
          firstVoicedReceipt !== null &&
          now() - Math.max(end, lastActivity) > 4500
        )
          break;
        await delay(90);
      }
      if (!output.length) throw Error("No translated audio in drain window");
      if (now() - Math.max(end, lastActivity) < 4400)
        throw Error("Output drain deadline reached");
      stream.close();
    }
    await queue;
    const limit = now() + 65000;
    while (
      (await page.evaluate(() => window.s2stPlayer.mark())).pending &&
      now() < limit
    )
      await delay(80);
    if (playbackFailure)
      throw Error("Browser playback or caption delivery failed");
  } catch (e) {
    failure = e instanceof Error ? e.message : "Trial failed";
  } finally {
    stream?.close();
    clearTimeout(cutTimer);
  }
  await queue;
  const player = await page.evaluate(() => window.s2stPlayer.mark());
  if (player.pending || player.firstVoiced === null || player.ended === null)
    failure ??= "No complete voiced browser playback";
  const pcm = Buffer.concat(source),
    voice = voicedBounds(pcm, 16000);
  const hash = createHash("sha256").update(pcm).digest("hex");
  const offset = (time: number | null) =>
    time === null ? null : Math.round(time - origin);
  const metrics = {
    engine: selected,
    model:
      selected === "gemini" ? model : "Saaras v4 / Mayura v1 / Bulbul v4 Flash",
    source: lang,
    speakerId: (input === "mic" ? "microphone-" : "fixture-") + lang,
    target,
    sourcePcmSha256: hash,
    inputMs: pcm.length / 32,
    firstInputSpeechMs: voice.first,
    endOfSourceSpeechMs: voice.last,
    firstTranscriptMs: offset(firstTranscript),
    firstAudioReceiptMs: offset(firstAudio),
    firstVoicedReceiptMs: offset(firstVoicedReceipt),
    browserFirstVoicedMs: offset(player.firstVoiced),
    browserLastVoicedMs: offset(player.lastVoiced),
    browserLastEndedMs: offset(player.ended),
    speechToFirstVoicedPlaybackMs:
      player.firstVoiced !== null && voice.first !== null
        ? Math.round(player.firstVoiced - origin - voice.first)
        : null,
    endToFirstVoicedPlaybackMs:
      player.firstVoiced !== null && voice.last !== null
        ? Math.round(player.firstVoiced - origin - voice.last)
        : null,
    gaps: player.gaps,
    discardedBuffers: player.discarded,
    failure,
  };
  await writeFile(join(dir, "original.wav"), wav(pcm, 16000));
  if (selected === "gemini" && output.length)
    await writeFile(
      join(dir, "translated.wav"),
      wav(Buffer.concat(output), 24000),
    );
  if (selected === "sarvam")
    for (const [index, bytes] of output.entries()) {
      await writeFile(
        join(
          dir,
          output.length === 1
            ? "translated.wav"
            : "translated-" + (index + 1) + ".wav",
        ),
        bytes,
      );
    }
  await writeFile(
    join(dir, "review.json"),
    JSON.stringify(
      {
        metrics,
        usage: usage.map((u) => ({ ...u, at: offset(u.at) })),
        events: events.map((e) => ({ ...e, at: offset(e.at) })),
        humanReview: null,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(metrics));
  await page.close();
  if (failure) process.exitCode = 1;
}
try {
  const dirs: ("en" | "te")[] =
    direction === "both" ? ["te", "en"] : [direction as "en" | "te"];
  const results = await Promise.allSettled(dirs.map(trial));
  for (const result of results)
    if (result.status === "rejected") {
      console.error(
        "Trial setup failed:",
        result.reason instanceof Error ? result.reason.message : "unknown",
      );
      process.exitCode = 1;
    }
} finally {
  await browser.close();
}
