import { AccessToken, TrackSource } from "livekit-server-sdk";
import type {
  AudioStream,
  Room as RtcRoom,
  RemoteTrack,
} from "@livekit/rtc-node";
import { roomState, Problem } from "./rooms.ts";
import { processStage } from "./turns.ts";
import { database } from "./db.ts";
import {
  beginLive,
  appendFrame,
  finishLive,
  interpretDraft,
  cancelRoomStream,
} from "./live.ts";
import { otherLanguage } from "../shared.ts";
import { supportsVoice } from "../voices.ts";

type Bridge = {
  rtc: RtcRoom;
  epoch: number;
  connected: Promise<void>;
  stop: AbortController;
  voices: Map<string, string>;
  issues: Map<string, string>;
  idle: ReturnType<typeof setTimeout>;
};
const holder = globalThis as typeof globalThis & {
  sahvaMeetings?: Map<string, Bridge>;
};
const bridges = (holder.sahvaMeetings ??= new Map());
const scope = (id: string, epoch: number) => "sahva-" + id + "-" + epoch;
export function meetingIssues(id: string) {
  return Object.fromEntries(bridges.get(id)?.issues ?? []);
}

export function stopMeeting(id: string) {
  const b = bridges.get(id);
  if (!b) return;
  bridges.delete(id);
  clearTimeout(b.idle);
  b.stop.abort();
  cancelRoomStream(id);
  void b.rtc.disconnect().catch(() => {});
}

async function credential(
  id: string,
  epoch: number,
  identity: string,
  worker: boolean,
) {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity, ttl: "2m" },
  );
  token.addGrant({
    roomJoin: true,
    room: scope(id, epoch),
    canSubscribe: worker,
    canPublish: !worker,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    hidden: worker,
    canPublishSources: worker ? [] : [TrackSource.MICROPHONE],
  });
  return token.toJwt();
}

// Each subscribed microphone has its own ordered reader, pre-roll and ASR session.
async function interpretTrack(
  b: Bridge,
  id: string,
  person: string,
  track: RemoteTrack,
  Stream: typeof AudioStream,
) {
  const stream = new Stream(track, {
    sampleRate: 16000,
    numChannels: 1,
    frameSizeMs: 100,
  });
  const reader = stream.getReader();
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  b.stop.signal.addEventListener("abort", abort, { once: true });
  const pre: Buffer[] = [];
  let key: string | undefined,
    seq = 0,
    silent = 0,
    onset = 0,
    lastVoiced = 0;
  let voice: string | undefined;
  async function finish(cancel = false) {
    if (!key) return;
    const savedKey = key;
    key = undefined;
    const saved = await finishLive(id, person, {
      key: savedKey,
      cancel,
      voice,
      capture: { onset, lastVoiced, uncertainty: 100 },
    });
    if (
      !cancel &&
      saved &&
      typeof saved === "object" &&
      "id" in saved &&
      typeof saved.id === "string"
    ) {
      const turnId = saved.id;
      // Finalize the delivery while the microphone reader continues with the next phrase.
      void (async () => {
        for (let stage = 0; stage < 3; stage++)
          if (!(await processStage(id, person, turnId, false))) break;
      })().catch(() => {
        /* Room polling resumes a persisted, unclaimed stage. */
      });
    }
    seq = 0;
    silent = 0;
  }
  try {
    while (!b.stop.signal.aborted) {
      const { done, value } = await reader.read();
      if (done || b.stop.signal.aborted) break;
      const samples = value.data;
      let energy = 0;
      for (const sample of samples) energy += sample * sample;
      const voiced = energy / Math.max(1, samples.length) > 180 * 180;
      const frame = Buffer.from(
        new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength),
      );
      if (voiced) lastVoiced = Date.now();
      if (!key) {
        pre.push(frame);
        if (pre.length > 4) pre.shift();
        if (!voiced) continue;
        onset = lastVoiced;
        voice = b.voices.get(person);
        key = (await beginLive(id, person, "livekit", b.epoch)).key;
        b.stop.signal.throwIfAborted();
        b.issues.delete(person);
      } else pre.push(frame);
      let ended = false;
      for (const piece of pre.splice(0)) {
        const reply = appendFrame(id, person, {
          key,
          seq: seq++,
          audio: piece.toString("base64"),
        });
        if (reply.text && !reply.done)
          void interpretDraft(id, person, { key }).catch(() => {});
        if (reply.done) {
          ended = true;
          break;
        }
      }
      silent = voiced ? 0 : silent + 1;
      if (ended || silent >= 14 || seq >= 245) await finish();
    }
  } finally {
    b.stop.signal.removeEventListener("abort", abort);
    try {
      await finish(b.stop.signal.aborted);
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
}

function bridge(
  id: string,
  epoch: number,
  expiry: string,
  rtcSdk: typeof import("@livekit/rtc-node"),
) {
  const old = bridges.get(id);
  if (old?.epoch === epoch) return old;
  if (old && old.epoch > epoch)
    throw new Problem(
      409,
      "MEETING_CHANGED",
      "Meeting audio changed. Rejoin to continue.",
    );
  if (old) stopMeeting(id);
  const { Room, RoomEvent, AudioStream } = rtcSdk;
  const rtc = new Room();
  const b: Bridge = {
    rtc,
    epoch,
    connected: Promise.resolve(),
    stop: new AbortController(),
    voices: new Map(),
    issues: new Map(),
    idle: setTimeout(() => stopMeeting(id), 30000),
  };
  bridges.set(id, b);
  const emptyTimer = () => {
    clearTimeout(b.idle);
    const timeout = rtc.remoteParticipants.size
      ? Date.parse(expiry) - Date.now()
      : 30000;
    b.idle = setTimeout(
      () => {
        if (bridges.get(id) === b) stopMeeting(id);
      },
      Math.max(1, timeout),
    );
  };
  rtc.on(RoomEvent.ParticipantConnected, emptyTimer);
  rtc.on(RoomEvent.ParticipantDisconnected, emptyTimer);
  rtc.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
    void interpretTrack(b, id, participant.identity, track, AudioStream).catch(
      () => {
        if (!b.stop.signal.aborted)
          b.issues.set(
            participant.identity,
            "Speech connection interrupted. Rejoin meeting audio to resume.",
          );
      },
    );
  });
  rtc.on(RoomEvent.Disconnected, () => {
    if (bridges.get(id) === b) stopMeeting(id);
  });
  b.connected = credential(id, epoch, "interpreter", true)
    .then((token) =>
      rtc.connect(process.env.LIVEKIT_URL!, token, {
        autoSubscribe: true,
        dynacast: false,
      }),
    )
    .catch(() => {
      if (bridges.get(id) === b) stopMeeting(id);
      throw new Problem(
        503,
        "LIVEKIT_CONNECT",
        "Meeting audio is unavailable. Try connecting again.",
      );
    });
  return b;
}
export async function joinMeeting(id: string, person: string, voice: unknown) {
  const db = await database();
  const state = await roomState(db.query, id, person);
  if (state.room.transport !== "livekit" || !state.canRecord)
    throw new Problem(
      403,
      "MEETING_CONSENT",
      "Meeting audio needs at least two members and everyone’s consent.",
    );
  if (
    !process.env.LIVEKIT_URL ||
    !process.env.LIVEKIT_API_KEY ||
    !process.env.LIVEKIT_API_SECRET ||
    process.env.SAHVA_LIVEKIT !== "1"
  )
    throw new Problem(503, "MEETING_CONFIG", "Meeting audio is unavailable.");
  const rtcSdk = await import("@livekit/rtc-node");
  const b = bridge(id, state.room.media_epoch, state.room.expires_at, rtcSdk);
  await b.connected;
  if (b.stop.signal.aborted)
    throw new Problem(
      409,
      "MEETING_CHANGED",
      "Meeting audio changed. Rejoin to continue.",
    );
  if (supportsVoice(otherLanguage(state.me.speaking), voice))
    b.voices.set(person, voice);
  return {
    url: process.env.LIVEKIT_URL,
    token: await credential(id, b.epoch, person, false),
  };
}
