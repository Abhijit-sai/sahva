/** Isolated provider comparison. Both paths consume the same normalized audio samples. */
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { loadRecording, wav as encodeWav } from "./s2st/audio.ts";
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
const eventSchema = z.object({
  event: z.string(),
  text: z.string().max(4000).optional(),
});
const elapsed = (since: number) => Math.round(performance.now() - since);

async function load(source: Language) {
  const path = join(folder, source === "te-IN" ? "telugu.wav" : "english.wav");
  const pcm = await loadRecording(path);
  const wav = encodeWav(pcm, 16000);
  return {
    source,
    target: source === "te-IN" ? ("en-IN" as const) : ("te-IN" as const),
    pcm,
    wav,
    pcmSha256: createHash("sha256").update(pcm).digest("hex"),
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
  await writeFile(
    join(dir, "offline.json"),
    JSON.stringify(
      {
        source,
        target,
        sha256: hash,
        pcmSha256: clip.pcmSha256,
        sourceText: base.text,
        translatedText: baseMt.text,
        asrMs: base.elapsedMs,
        mtMs: baseMt.elapsedMs,
        ttsMs: baseVoice.elapsedMs,
        totalMs: baseCompleteMs,
        outputSha256: createHash("sha256")
          .update(baseVoice.audio)
          .digest("hex"),
        speaker: baseVoice.speaker,
        models: ["saaras:v4", "mayura:v1", "bulbul:v4-flash"],
      },
      null,
      2,
    ),
  );
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
      pcmSha256: clip.pcmSha256,
      streamWavSha256: createHash("sha256").update(audio).digest("hex"),
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
const preparations = await Promise.allSettled(inputs.map(compare));
// Begin both paced streams together when both offline arms succeeded.
await Promise.all(
  preparations.map(async (arm, i) => {
    const clip = inputs[i];
    try {
      if (arm.status === "rejected") throw arm.reason;
      await arm.value();
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN_FAILURE";
      const phase = arm.status === "rejected" ? "offline" : "paced";
      await writeFile(
        join(resultFolder, clip.source, "failure.json"),
        JSON.stringify({
          source: clip.source,
          target: clip.target,
          pcmSha256: clip.pcmSha256,
          phase,
          code,
        }),
      );
      console.error(clip.source, phase, "failed:", code);
      process.exitCode = 1;
    }
  }),
);
console.log("Private same-recording comparison:", resultFolder);
