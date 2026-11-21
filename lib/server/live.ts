import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { z } from "zod";
import { database, local } from "./db.ts";
import { setRecording } from "./recording.ts";
import { Problem } from "./rooms.ts";
import { SarvamSpeech } from "../providers/sarvam.ts";
import { upload } from "./turns.ts";
import { otherLanguage, type Language } from "../shared.ts";

import { serverTime, type TurnTiming } from "../rehearsal.ts";

type Session = {
  timing: TurnTiming;
  room: string;
  person: string;
  key: string;
  language: Language;
  socket: WebSocket;
  target: Language;
  translated: string;
  lastAttempt: number;
  lastText: string;
  translating: boolean;
  chunks: Buffer[];
  bytes: number;
  text: string;
  final: boolean;
  failed: boolean;
  timer: ReturnType<typeof setTimeout>;
  saving?: Promise<unknown>;
};
const holder = globalThis as typeof globalThis & {
  sahvaStreams?: Map<string, Session>;
};
const streams = (holder.sahvaStreams ??= new Map());
const frame = z.object({
  key: z.uuid(),
  seq: z.int().min(0).max(260),
  audio: z.base64().min(4).max(22000),
});
const caption = z.object({
  event: z.enum(["transcript.partial", "transcript.final"]),
  text: z.string().trim().min(1).max(4000),
});
const streamId = (room: string, person: string) => room + "/" + person;
function dispose(s: Session) {
  const id = streamId(s.room, s.person);
  if (streams.get(id) === s) streams.delete(id);
  clearTimeout(s.timer);
  if (s.socket.readyState !== WebSocket.CLOSED) s.socket.terminate();
}
export function cancelRoomStream(room: string) {
  for (const s of streams.values()) if (s.room === room) dispose(s);
}
export function liveCaptions(room: string) {
  return Array.from(streams.values())
    .filter((s) => s.room === room)
    .map((s) => ({
      key: s.key,
      speaker: s.person,
      interimAt: s.timing.interim,
      text: s.text,
      translated: s.translated,
      target: s.target,
      final: s.final,
    }));
}
function owned(room: string, person: string, key: string) {
  const s = streams.get(streamId(room, person));
  if (!s || s.person !== person || s.key !== key)
    throw new Problem(
      409,
      "LIVE_EXPIRED",
      "Live microphone session has ended. Start a new phrase.",
    );
  return s;
}
export async function beginLive(
  room: string,
  person: string,
  transport: "phrase" | "livekit" = "phrase",
  epoch?: number,
) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || (local() && process.env.SAHVA_OFFLINE_TEST === "1"))
    throw new Problem(
      503,
      "LIVE_CONFIG",
      "Live captions need the speech provider. Use a recorded turn.",
    );
  const key = randomUUID();
  const state = await setRecording(
    room,
    person,
    { key, recording: true },
    transport,
    epoch,
  );
  const params = new URLSearchParams({
    model: "saaras:v4",
    language_code: state.me.speaking,
    encoding: "linear16",
    sample_rate: "16000",
    stream_type: "fast",
    endpointing: "vad",
    silence_duration_ms: "700",
  });
  const socket = new WebSocket(
    "wss://api.sarvam.ai/speech-to-text-realtime/ws?" + params,
    {
      headers: { "api-subscription-key": apiKey },
      handshakeTimeout: 5000,
      maxPayload: 65536,
    },
  );
  const old = streams.get(streamId(room, person));
  if (old) dispose(old);
  const s: Session = {
    room,
    person,
    key,
    language: state.me.speaking,
    target:
      transport === "livekit"
        ? otherLanguage(state.me.speaking)
        : state.members.find((m) => m.id !== person)!.listening,
    timing: {},
    translated: "",
    lastAttempt: 0,
    lastText: "",
    translating: false,
    socket,
    chunks: [],
    bytes: 0,
    text: "",
    final: false,
    failed: false,
    timer: setTimeout(() => dispose(s), 35000),
  };
  streams.set(streamId(room, person), s);
  socket.on("error", () => {
    s.failed = true;
  });
  socket.on("close", () => {
    s.failed = true;
  });
  socket.on("message", (raw) => {
    try {
      const data: unknown = JSON.parse(raw.toString());
      const item = caption.safeParse(data);
      if (item.success && !s.final) {
        if (item.data.event === "transcript.final")
          s.timing.final = serverTime();
        else s.timing.interim ??= serverTime();
        s.text = item.data.text;
        s.final = item.data.event === "transcript.final";
      } else if (
        z.object({ event: z.literal("error") }).safeParse(data).success
      )
        s.failed = true;
    } catch {
      s.failed = true;
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
      socket.once("close", () => reject(new Error("closed")));
    });
    if (streams.get(streamId(room, person)) !== s) throw Error("expired");
    return { key };
  } catch {
    dispose(s);
    await setRecording(room, person, { key, recording: false });
    throw new Problem(
      503,
      "LIVE_CONNECT",
      "Live speech connection unavailable. Try a recorded turn.",
    );
  }
}
export async function interpretDraft(
  room: string,
  person: string,
  input: unknown,
) {
  const { key } = z.object({ key: z.uuid() }).parse(input);
  const s = owned(room, person, key);
  const text = s.text;
  if (
    !text ||
    s.translating ||
    s.lastText === text ||
    Date.now() - s.lastAttempt < 1800 ||
    s.saving
  )
    return;
  if (s.language === s.target) {
    s.translated = text;
    return;
  }
  s.translating = true;
  s.lastAttempt = Date.now();
  s.lastText = text;
  try {
    const result = await new SarvamSpeech(
      process.env.SARVAM_API_KEY!,
    ).translate(text, s.language, s.target);
    if (streams.get(streamId(room, person)) === s) s.translated = result.text;
  } catch {
    /* The durable turn retries translation independently after the phrase. */
  } finally {
    s.translating = false;
  }
}
export function appendFrame(room: string, person: string, input: unknown) {
  const { key, seq, audio } = frame.parse(input);
  const s = owned(room, person, key);
  if (s.saving)
    throw new Problem(409, "LIVE_SAVING", "This phrase is being saved.");
  if (seq > s.chunks.length)
    throw new Problem(409, "LIVE_ORDER", "Audio arrived out of order.");
  if (seq === s.chunks.length && !s.final) {
    const bytes = Buffer.from(audio, "base64");
    if (
      bytes.length % 2 ||
      bytes.length > 16000 ||
      s.bytes + bytes.length > 832000
    )
      throw new Problem(
        413,
        "LIVE_SIZE",
        "Live phrases are limited to 25 seconds.",
      );
    s.chunks.push(bytes);
    s.bytes += bytes.length;
    if (!s.failed && s.socket.readyState === WebSocket.OPEN)
      s.socket.send(JSON.stringify({ event: "audio_input", audio }));
  }
  return { text: s.text, done: s.final || s.failed || s.bytes >= 800000 };
}
function wave(samples: Buffer, rate = 16000) {
  const h = Buffer.alloc(44);
  h.write("RIFF");
  h.writeUInt32LE(samples.length + 36, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(samples.length, 40);
  return Buffer.concat([h, samples]);
}
export async function finishLive(room: string, person: string, input: unknown) {
  const { key, cancel, capture, voice } = z
    .object({
      key: z.uuid(),
      cancel: z.boolean().default(false),
      voice: z.string().max(64).optional(),
      capture: z
        .object({
          onset: z.int().positive(),
          lastVoiced: z.int().positive(),
          uncertainty: z.int().nonnegative().max(60000),
        })
        .optional()
        .catch(undefined),
    })
    .parse(input);
  const s = streams.get(streamId(room, person));
  if (!s || s.key !== key || s.person !== person) {
    if (!cancel) {
      const db = await database();
      const [saved] = await db.query(
        "select id,seq from sahva.turns where room_id=$1 and speaker_id=$2 and idem=$3",
        [room, person, key],
      );
      if (saved) return saved;
    }
    if (cancel) return { cancelled: true };
    throw new Problem(
      409,
      "LIVE_EXPIRED",
      "This phrase expired. Start a new phrase.",
    );
  }
  if (s.saving) return s.saving;
  if (cancel || s.bytes < 6400) {
    dispose(s);
    await setRecording(room, person, { key, recording: false });
    return { cancelled: true };
  }
  const form = new FormData();
  form.set(
    "audio",
    new Blob([new Uint8Array(wave(Buffer.concat(s.chunks)))], {
      type: "audio/wav",
    }),
    "phrase.wav",
  );
  form.set("idempotencyKey", key);
  if (voice !== undefined) form.set("voice", voice);
  const now = serverTime();
  if (
    capture &&
    capture.onset >= now - 65000 &&
    capture.lastVoiced >= capture.onset &&
    capture.lastVoiced <= now + capture.uncertainty
  )
    s.timing.capture = capture;
  s.saving = upload(
    room,
    person,
    form,
    s.final ? { text: s.text, source: s.language } : undefined,
    s.timing,
  )
    .then(async (saved) => {
      dispose(s);
      await setRecording(room, person, { key, recording: false });
      return saved;
    })
    .catch((e) => {
      s.saving = undefined;
      throw e;
    });
  return s.saving;
}
