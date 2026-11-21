import { randomUUID } from "node:crypto";
import { enter } from "../../lib/server/rooms.ts";
import {
  appendFrame,
  beginLive,
  cancelRoomStream,
  finishLive,
  interpretDraft,
} from "../../lib/server/live.ts";
import { media, processStage, timeline } from "../../lib/server/turns.ts";
import { local } from "../../lib/server/db.ts";
import { meetingConsent, otherLanguage } from "../../lib/shared.ts";
import type { Language } from "../../lib/providers/sarvam.ts";
import type { Hooks } from "./engines.ts";

// This process supplies the frames that the native RTC track reader would normally produce.
// Fresh embedded room storage exercises the released ASR/draft/final/MT/TTS and delivery stages.
export async function baseline(source: Language, hooks: Hooks) {
  if (process.env.NODE_ENV === "production")
    throw Error("The benchmark requires local storage");
  process.env.SAHVA_LOCAL = "1";
  process.env.SAHVA_OFFLINE_TEST = "0";
  process.env.SAHVA_TEST_RUN = runId;
  process.env.SAHVA_LIVEKIT = "1";
  process.env.LIVEKIT_URL = "ws://127.0.0.1:1";
  process.env.LIVEKIT_API_KEY = "fixture";
  process.env.LIVEKIT_API_SECRET = "fixture";
  if (!local() || !process.env.SARVAM_API_KEY?.trim())
    throw Error("Local database and Sarvam key required");
  const profile = {
    acceptedConsent: true,
    consentVersion: meetingConsent,
    transport: "livekit",
  };
  const target = otherLanguage(source);
  const a = await enter({
    ...profile,
    name: "Synthetic source",
    speakingLanguage: source,
    listeningLanguage: source,
  });
  const b = await enter(
    {
      ...profile,
      name: "Synthetic listener",
      speakingLanguage: target,
      listeningLanguage: target,
      invite: a.invite,
    },
    a.id,
  );
  let key = "",
    seq = 0,
    quiet = 0,
    lastText = "",
    failure: Error | undefined,
    sequence = Promise.resolve();
  const pre: Buffer[] = [];
  async function finish() {
    if (!key) return;
    const segment = key;
    const saved = await finishLive(a.id, a.member, { key });
    key = "";
    seq = 0;
    quiet = 0;
    lastText = "";
    if (!saved || !("id" in saved) || typeof saved.id !== "string")
      throw Error("Baseline archive failed");
    const id = saved.id;
    // Start final stages promptly, serialize only delivery order.
    const delivery = (async () => {
      for (let i = 0; i < 3; i++)
        if (!(await processStage(a.id, a.member, id, false))) break;
      const turn = (await timeline(a.id, b.member)).turns.find(
        (t) => t.id === id,
      );
      if (
        !turn?.voice ||
        typeof turn.raw_text !== "string" ||
        typeof turn.translated_text !== "string"
      )
        throw Error("Baseline turn failed to finalize");
      const bytes = Buffer.from(
        await (await media(a.id, b.member, id, "translation")).arrayBuffer(),
      );
      return { bytes, source: turn.raw_text, target: turn.translated_text };
    })();
    void delivery.catch(() => {});
    sequence = sequence
      .then(async () => {
        const result = await delivery;
        hooks.text("source", result.source, true, source, segment);
        hooks.text("target", result.target, true, target, segment);
        hooks.audio(result.bytes, "wav");
      })
      .catch(() => {
        failure = Error("Baseline delivery failed");
      });
  }
  return {
    async feed(frame: Buffer) {
      if (failure) throw failure;
      let sum = 0;
      for (let i = 0; i < frame.length; i += 2)
        sum += frame.readInt16LE(i) ** 2;
      const voiced = sum / (frame.length / 2) > 180 ** 2;
      pre.push(frame);
      if (!key) {
        if (pre.length > 4) pre.shift();
        if (!voiced) return;
        key = (await beginLive(a.id, a.member, "livekit", 0)).key;
      }
      let done = false;
      for (const piece of pre.splice(0)) {
        const r = appendFrame(a.id, a.member, {
          key,
          seq: seq++,
          audio: piece.toString("base64"),
        });
        if (r.text && r.text !== lastText) {
          hooks.text("source", r.text, r.done, source, key);
          lastText = r.text;
        }
        if (r.text && !r.done)
          void interpretDraft(a.id, a.member, { key }).catch(() => {});
        if (r.done) {
          done = true;
          break;
        }
      }
      quiet = voiced ? 0 : quiet + 1;
      if (done || quiet >= 14 || seq >= 245) await finish();
    },
    async finish() {
      await finish();
      await sequence;
      if (failure) throw failure;
    },
    check() {
      if (failure) throw failure;
    },
    close() {
      cancelRoomStream(a.id);
    },
  };
}
const runId = "s2st-" + randomUUID();
