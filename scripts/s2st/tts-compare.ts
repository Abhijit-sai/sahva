/** Text-only, private listening comparison using released preset voices. */
import { createHash, randomInt } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { voices } from "../../lib/voices.ts";
import { loadRecording, voicedBounds, wav } from "./audio.ts";
import { recordingSheet } from "./recording-sheet.ts";

const studio = "https://maya-research-maya2-native-studio.hf.space";
const digest = (b: string | Buffer) =>
  createHash("sha256").update(b).digest("hex");
type Language = keyof typeof voices;
type Clip = { id: string; target: Language; text: string };
const receiptTime = (start: number) => Math.round(performance.now() - start);
const fixtureFile = process.argv[2];
const repeats = Number(process.argv[3] ?? 1);
if (!fixtureFile || !Number.isInteger(repeats) || repeats < 1 || repeats > 5)
  throw Error("Supply --fictional or a reviewed manifest, and 1–5 repeats");
const clips: Clip[] = [];
if (fixtureFile === "--fictional") {
  const sheet = await recordingSheet();
  for (const id of ["01", "02", "03", "04", "05"]) {
    const row = sheet.get(id);
    if (!row) throw Error("Missing fictional prompt " + id);
    clips.push(
      { id: "en-" + id, target: "en-IN", text: row.en },
      { id: "te-" + id, target: "te-IN", text: row.te },
    );
  }
} else {
  const rows = z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,64}$/),
        target: z.enum(["en-IN", "te-IN"]),
        targetText: z.string().trim().min(1).max(1200),
        confirmedBy: z.string().trim().min(1),
        referenceRevision: z.string().min(1),
        consentRecord: z.string().min(1),
        speechTestPermissions: z.object({
          sarvamAndHostedMayaTargetText: z.literal(true),
        }),
        wav: z.string().min(1),
        pcmSha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .min(1)
    .max(200)
    .parse(JSON.parse(await readFile(fixtureFile, "utf8")));
  for (const r of rows) {
    if (
      digest(await loadRecording(resolve(dirname(fixtureFile), r.wav))) !==
      r.pcmSha256
    )
      throw Error("Source audio changed for " + r.id);
    clips.push({ id: r.id, target: r.target, text: r.targetText });
  }
}
if (new Set(clips.map((c) => c.id)).size !== clips.length)
  throw Error("Duplicate fixture id");
const key = process.env.SARVAM_API_KEY;
if (!key) throw Error("SARVAM_API_KEY required");

// A RIFF header may contain ancillary chunks before the PCM data.
function containsPcmFrame(b: Buffer) {
  if (
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WAVE"
  )
    return false;
  let align = 0;
  for (let at = 12; at + 8 <= b.length; ) {
    const tag = b.toString("ascii", at, at + 4),
      len = b.readUInt32LE(at + 4);
    if (
      tag === "fmt " &&
      len >= 16 &&
      at + 24 <= b.length &&
      b.readUInt16LE(at + 8) === 1
    )
      align = b.readUInt16LE(at + 20);
    if (tag === "data") return align > 0 && b.length >= at + 8 + align;
    at += 8 + len + (len % 2);
  }
  return false;
}
async function bulbul(c: Clip) {
  const voice = voices[c.target][0].id;
  const start = performance.now();
  const response = await fetch("https://api.sarvam.ai/text-to-speech/stream", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "api-subscription-key": key!,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "bulbul:v4-flash",
      speaker: voice,
      language_code: c.target,
      text: c.text,
      ...(c.target === "te-IN" ? { pace: 1.2, pitch: -0.1 } : {}),
      output_audio_codec: "wav",
    }),
  });
  if (!response.ok || !response.body)
    throw Error("BULBUL_HTTP_" + response.status);
  const chunks: Buffer[] = [];
  let firstMs: number | null = null,
    size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4_000_000) throw Error("WAV_TOO_LARGE");
      chunks.push(Buffer.from(value));
      if (firstMs === null && containsPcmFrame(Buffer.concat(chunks)))
        firstMs = receiptTime(start);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (firstMs === null) throw Error("NO_PCM");
  return {
    audio: Buffer.concat(chunks),
    firstMs,
    totalMs: receiptTime(start),
    voice,
    model: "bulbul:v4-flash",
    revision: null,
  };
}
async function maya(c: Clip, seed: number) {
  const voice = "Sreekar",
    start = performance.now(),
    signal = AbortSignal.timeout(150000);
  const route = studio + "/gradio_api/call/speak_stream";
  const call = await fetch(route, {
    method: "POST",
    redirect: "error",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      data: [
        c.text,
        c.target.slice(0, 2),
        voice,
        true,
        seed,
        false,
        null,
        "",
        "en",
      ],
    }),
  });
  if (!call.ok) throw Error("MAYA_HTTP_" + call.status);
  const { event_id: id } = await call.json();
  if (typeof id !== "string" || !/^[0-9a-f]{32}$/.test(id))
    throw Error("MAYA_EVENT_ID");
  const stream = await fetch(route + "/" + id, { signal, redirect: "error" });
  if (!stream.ok || !stream.body) throw Error("MAYA_HTTP_" + stream.status);
  const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader(),
    chunks: Buffer[] = [];
  let tail = "",
    event = "",
    size = 0,
    firstMs: number | null = null,
    finished = false;
  try {
    while (!finished) {
      const part = await reader.read();
      if (part.done) break;
      tail += part.value;
      const lines = tail.split("\n");
      tail = lines.pop()!;
      if (tail.length > 1_000_000) throw Error("MAYA_EVENT_LENGTH");
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.startsWith("event: ")) event = line.slice(7);
        if (!line.startsWith("data: ") || event === "heartbeat") continue;
        const data = JSON.parse(line.slice(6));
        const v = Array.isArray(data) ? data[0] : null;
        if (event === "error" || v?.type === "error") {
          const reason = JSON.stringify(data);
          if (/quota|rate.limit/i.test(reason)) throw Error("MAYA_QUOTA");
          throw Error("MAYA_GENERATION_ERROR");
        }
        if (event === "generating" && v?.type === "audio") {
          const pcm = Buffer.from(v.audio, "base64");
          if (!pcm.length || pcm.length % 2 || (size += pcm.length) > 4_000_000)
            throw Error("MAYA_PCM");
          firstMs ??= receiptTime(start);
          chunks.push(pcm);
        }
        if (event === "complete" && v?.type === "done" && v.seed === seed)
          finished = true;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!finished || firstMs === null) throw Error("MAYA_INCOMPLETE");
  return {
    audio: wav(Buffer.concat(chunks), 24000),
    firstMs,
    totalMs: receiptTime(start),
    voice,
    model: "maya-research/maya2-native",
    revision: null,
    seed,
    hosting: "Maya Research HF Studio",
  };
}

await mkdir(".sahva", { recursive: true });
const out = await mkdtemp(".sahva/tts-comparison-");
await writeFile(join(out, "listening-inputs.json"), JSON.stringify(clips));
console.log("Private TTS results", out);
let quota = false;
for (let repeat = 1; repeat <= repeats; repeat++)
  for (const c of clips) {
    const engines = randomInt(2) ? ["maya", "bulbul"] : ["bulbul", "maya"];
    for (const [idx, engine] of engines.entries()) {
      const stem = join(out, c.id + "-" + repeat + "-" + (idx ? "B" : "A"));
      const meta = {
        fixture: c.id,
        repeat,
        engine,
        target: c.target,
        textSha256: digest(c.text),
      };
      try {
        if (engine === "maya" && quota) throw Error("MAYA_SKIPPED_QUOTA");
        const { audio, ...timing } =
          engine === "maya" ? await maya(c, 42 + repeat - 1) : await bulbul(c);
        await writeFile(stem + ".wav", audio, { flag: "wx" });
        const decoded = await loadRecording(stem + ".wav");
        if (voicedBounds(decoded, 16000).first === null)
          throw Error("SILENT_OUTPUT");
        await writeFile(
          stem + ".json",
          JSON.stringify({
            ...meta,
            ...timing,
            status: "ok",
            wavSha256: digest(audio),
            seconds: decoded.length / 32000,
          }),
        );
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        const reason =
          /^(MAYA|BULBUL)_[A-Z0-9_]+$|^(NO_PCM|WAV_TOO_LARGE|SILENT_OUTPUT)$/.test(
            raw,
          )
            ? raw
            : "REQUEST_OR_DECODE_FAILED";
        if (reason === "MAYA_QUOTA" || reason === "MAYA_HTTP_429") quota = true;
        const status = reason === "MAYA_SKIPPED_QUOTA" ? "skipped" : "failed";
        await writeFile(
          stem + ".json",
          JSON.stringify({ ...meta, status, reason }),
        );
        console.error(c.id, engine, reason);
        process.exitCode = 1;
      }
    }
  }
