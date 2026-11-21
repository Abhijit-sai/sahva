/** Isolated provider comparison. Both paths consume the same normalized audio samples. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import WebSocket from "ws";
import { z } from "zod";
import { SarvamSpeech, type Language } from "../lib/providers/sarvam.ts";

const [folder, consent] = process.argv.slice(2);
if (!folder || consent !== "--consented")
  throw Error(
    "Supply a fixture directory containing english.wav and telugu.wav, followed by --consented.",
  );
const key = process.env.SARVAM_API_KEY;
if (!key) throw Error("SARVAM_API_KEY is required");
const speech = new SarvamSpeech(key);
await mkdir(".sahva", { recursive: true });
const resultFolder = await mkdtemp(".sahva/directions-");
const decode = promisify(execFile);
const eventSchema = z.object({
  event: z.string(),
  text: z.string().max(4000).optional(),
});
const elapsed = (since: number) => Math.round(performance.now() - since);

async function load(source: Language) {
  const path = join(folder, source === "te-IN" ? "telugu.wav" : "english.wav");
  if ((await stat(path)).size > 4_000_000)
    throw Error("Input exceeds the room audio limit");
  const { stdout: pcm } = await decode(
    "ffmpeg",
    [
      "-nostdin",
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-f",
      "wav",
      "-i",
      path,
      "-map",
      "0:a:0",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-t",
      "25.1",
      "-f",
      "s16le",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 850000,
      timeout: 10000,
      windowsHide: true,
    },
  );
  if (pcm.length < 6400 || pcm.length > 800000 || pcm.length % 2)
    throw Error("Use one 0.2–25 second WAV phrase per direction.");
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  const wav = Buffer.concat([header, pcm]);
  return {
    source,
    target: source === "te-IN" ? ("en-IN" as const) : ("te-IN" as const),
    pcm,
    wav,
    hash: createHash("sha256").update(wav).digest("hex"),
  };
}

async function streamTranscript(source: Language, pcm: Buffer) {
  const params = new URLSearchParams({
    model: "saaras:v4",
    language_code: source,
    encoding: "linear16",
    sample_rate: "16000",
    stream_type: "fast",
    endpointing: "manual",
  });
  const socket = new WebSocket(
    "wss://api.sarvam.ai/speech-to-text-realtime/ws?" + params,
    {
      headers: { "api-subscription-key": key! },
      handshakeTimeout: 5000,
      maxPayload: 65536,
    },
  );
  let firstCaptionMs: number | null = null;
  const start = performance.now();
  const deadline = AbortSignal.timeout(40000);
  const receive = new Promise<string>((resolve, reject) => {
    socket.on("message", (raw) => {
      try {
        const event = eventSchema.parse(JSON.parse(raw.toString()));
        if (event.event === "transcript.partial" && event.text)
          firstCaptionMs ??= elapsed(start);
        if (event.event === "transcript.final" && event.text?.trim())
          resolve(event.text.trim());
        if (event.event === "error")
          reject(Error("ASR stream reported an error"));
      } catch {
        reject(Error("Invalid ASR event"));
      }
    });
    socket.on("error", () => reject(Error("ASR socket failed")));
    socket.once("close", () => reject(Error("ASR closed before final text")));
  });
  async function send() {
    await once(socket, "open", { signal: deadline });
    socket.send(JSON.stringify({ event: "speech_start" }));
    const onset = performance.now();
    for (let offset = 0; offset < pcm.length; offset += 6400) {
      if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 64000)
        throw Error("ASR input interrupted or backed up");
      const frame = pcm.subarray(offset, offset + 6400);
      socket.send(
        JSON.stringify({
          event: "audio_input",
          audio: frame.toString("base64"),
        }),
      );
      await delay(
        Math.max(0, onset + (offset + frame.length) / 32 - performance.now()),
        undefined,
        { signal: deadline },
      );
    }
    socket.send(JSON.stringify({ event: "speech_end" }));
  }
  const expire = () => socket.terminate();
  deadline.addEventListener("abort", expire, { once: true });
  try {
    const [text] = await Promise.all([receive, send()]);
    return { text, firstCaptionMs, finalMs: elapsed(start) };
  } finally {
    deadline.removeEventListener("abort", expire);
    socket.terminate();
  }
}

async function compare(clip: Awaited<ReturnType<typeof load>>) {
  const { source, target, pcm, wav, hash } = clip;
  const dir = join(resultFolder, source);
  await mkdir(dir);
  await writeFile(join(dir, "original.wav"), wav);
  const baseStart = performance.now();
  const base = await speech.transcribe(
    new File([new Uint8Array(wav)], "phrase.wav", { type: "audio/wav" }),
  );
  if (base.language !== source)
    throw Error("Baseline detected a different language");
  const baseMt = await speech.translate(base.text, source, target);
  const baseVoice = await speech.synthesize(baseMt.text, target);
  const baseCompleteMs = elapsed(baseStart);
  await writeFile(join(dir, "base.wav"), baseVoice.audio);
  return async function stream() {
    const start = performance.now();
    const live = await streamTranscript(source, pcm);
    const mt = await speech.translate(live.text, source, target);
    const ttsStart = performance.now();
    const response = await fetch(
      "https://api.sarvam.ai/text-to-speech/stream",
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          "api-subscription-key": key!,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "bulbul:v4-flash",
          speaker: baseVoice.speaker,
          language_code: target,
          text: mt.text,
          ...(target === "te-IN" ? { pace: 1.2, pitch: -0.1 } : {}),
          output_audio_codec: "wav",
        }),
      },
    );
    if (!response.ok || !response.body)
      throw Error("Streaming TTS HTTP " + response.status);
    const chunks: Uint8Array[] = [];
    let size = 0,
      firstPayloadMs: number | null = null;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.length;
        if (size > 8000000) throw Error("Stream exceeded review limit");
        if (size > 44) firstPayloadMs ??= elapsed(ttsStart);
        chunks.push(chunk);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const audio = Buffer.concat(chunks);
    if (
      audio.toString("ascii", 0, 4) !== "RIFF" ||
      audio.toString("ascii", 8, 12) !== "WAVE" ||
      size <= 44
    )
      throw Error("Invalid streamed WAV");
    const completeMs = elapsed(start);
    await writeFile(join(dir, "stream.wav"), audio);
    const metrics = {
      source,
      target,
      sha256: hash,
      inputMs: pcm.length / 32,
      baseFileProcessingMs: baseCompleteMs,
      baseAsrMs: base.elapsedMs,
      baseMtMs: baseMt.elapsedMs,
      baseFullWavMs: baseVoice.elapsedMs,
      firstInterimMs: live.firstCaptionMs,
      streamFinalMs: live.finalMs,
      streamMtMs: mt.elapsedMs,
      streamTtsFirstPayloadMs: firstPayloadMs,
      streamCompleteIncludingSpeechMs: completeMs,
    };
    await writeFile(
      join(dir, "review.json"),
      JSON.stringify(
        {
          metrics,
          base: { source: base.text, target: baseMt.text },
          stream: { source: live.text, target: mt.text },
          humanReview: null,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(metrics));
  };
}

const inputs = await Promise.all([load("te-IN"), load("en-IN")]);
const trials = await Promise.all(inputs.map(compare));
// Start both recordings together. Each socket, transcript and output buffer belongs to one direction.
const results = await Promise.allSettled(trials.map((run) => run()));
for (const result of results)
  if (result.status === "rejected") {
    console.error(
      "Direction failed:",
      result.reason instanceof Error ? result.reason.message : "unknown",
    );
    process.exitCode = 1;
  }
console.log("Private same-recording comparison:", resultFolder);
