import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { z } from "zod";
import { database, local } from "./db.ts";
import { setRecording } from "./recording.ts";
import { Problem, roomState } from "./rooms.ts";
import { SarvamSpeech } from "../providers/sarvam.ts";
import { upload } from "./turns.ts";
import type { Language } from "../shared.ts";

type Session = {
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
  seq: z.int().min(0).max(150),
  audio: z.base64().min(4).max(22000),
});
const caption = z.object({
  event: z.enum(["transcript.partial", "transcript.final"]),
  text: z.string().trim().min(1).max(4000),
});
function dispose(s: Session) {
  if (streams.get(s.room) === s) streams.delete(s.room);
  clearTimeout(s.timer);
  if (s.socket.readyState !== WebSocket.CLOSED) s.socket.terminate();
}
export function cancelRoomStream(room: string) {
  const s = streams.get(room);
  if (s) dispose(s);
}
export function liveCaption(room: string) {
  const s = streams.get(room);
  return s
    ? {
        speaker: s.person,
        text: s.text,
        translated: s.translated,
        target: s.target,
        final: s.final,
      }
    : null;
}
function owned(room: string, person: string, key: string) {
  const s = streams.get(room);
  if (!s || s.person !== person || s.key !== key)
    throw new Problem(
      409,
      "LIVE_EXPIRED",
      "Live microphone session has ended. Start a new phrase.",
    );
  return s;
}
export async function beginLive(room: string, person: string) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || (local() && process.env.SAHVA_OFFLINE_TEST === "1"))
    throw new Problem(
      503,
      "LIVE_CONFIG",
      "Live captions need the speech provider. Use a recorded turn.",
    );
  const db = await database();
  const state = await roomState(db.query, room, person);
  const key = randomUUID();
  await setRecording(room, person, { key, recording: true });
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
  const old = streams.get(room);
  if (old) dispose(old);
  const s: Session = {
    room,
    person,
    key,
    language: state.me.speaking,
    target: state.members.find((m) => m.id !== person)!.listening,
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
  streams.set(room, s);
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
    if (streams.get(room) !== s) throw Error("expired");
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
    if (streams.get(room) === s) s.translated = result.text;
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
  const { key, cancel } = z
    .object({ key: z.uuid(), cancel: z.boolean().default(false) })
    .parse(input);
  const s = streams.get(room);
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
  s.saving = upload(
    room,
    person,
    form,
    s.final ? { text: s.text, source: s.language } : undefined,
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
