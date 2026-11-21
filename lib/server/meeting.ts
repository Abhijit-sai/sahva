import { randomUUID } from "node:crypto";
import { interpretedRoom, radioRoom } from "./interpretation-flag.ts";
export { interpretedRoom, radioRoom };
import { outputCredential, openPcmTrack } from "./interpretation-output.ts";
import { RadioMeeting } from "./radio-meeting.ts";
import { AccessToken, TrackSource } from "livekit-server-sdk";
import type {
  AudioStream,
  Room as RtcRoom,
  RemoteTrack,
} from "@livekit/rtc-node";
import { roomState, Problem } from "./rooms.ts";
import { MeetingArchive } from "./meeting-archive.ts";
import { database } from "./db.ts";
import { cancelRoomStream } from "./live.ts";
import { type Language } from "../shared.ts";

type Bridge = {
  rtc: RtcRoom;
  epoch: number;
  connected: Promise<void>;
  stop: AbortController;
  listeners: Map<string, AbortController>;
  radio: RadioMeeting;
  archive: MeetingArchive;
  speaking: Map<string, Language>;
  inputs: Map<string, AbortController>;
  issues: Map<string, string>;
  idle: ReturnType<typeof setTimeout>;
};
const holder = globalThis as typeof globalThis & {
  sahvaMeetings?: Map<string, Bridge>;
};
const bridges = (holder.sahvaMeetings ??= new Map<string, Bridge>());
const closing = new Map<string, Promise<void>>();
const scope = (id: string, epoch: number) => "sahva-" + id + "-" + epoch;
export function radioCaptions(id: string, person: string) {
  return bridges.get(id)?.radio?.captions(person) ?? [];
}
// Human source-room grants permit only microphone publications. Page presence alone is insufficient.
export function connectedMicrophones(id: string, epoch: number) {
  const b = bridges.get(id);
  if (!b || b.epoch !== epoch) return [];
  return Array.from(b.rtc.remoteParticipants.values())
    .filter((participant) =>
      Array.from(participant.trackPublications.values()).some(
        (pub) => pub.subscribed && pub.track,
      ),
    )
    .map((participant) => participant.identity);
}
export function meetingIssues(id: string) {
  return Object.fromEntries(bridges.get(id)?.issues ?? []);
}
export function stopMeeting(id: string) {
  const b = bridges.get(id);
  if (!b) return closing.get(id);
  const writes = b.radio.pendingWrites();
  bridges.delete(id);
  clearTimeout(b.idle);
  b.stop.abort();
  for (const listener of b.listeners.values()) listener.abort();
  b.listeners.clear();
  for (const input of b.inputs.values()) input.abort();
  cancelRoomStream(id);
  void b.rtc.disconnect().catch(() => {});
  const finishing = writes
    .then(() => b.archive.finish())
    .finally(() => {
      if (closing.get(id) === finishing) closing.delete(id);
    });
  closing.set(id, finishing);
  return finishing;
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

async function radioInput(
  b: Bridge,
  person: string,
  track: RemoteTrack,
  Stream: typeof AudioStream,
  stop: AbortSignal,
) {
  const lang = b.speaking.get(person);
  if (!b.radio || !lang || !track.sid) return;
  const ended = new AbortController();
  const signal = AbortSignal.any([stop, ended.signal]);
  const feed = b.radio.source(person, lang, track.sid, signal);
  const reader = new Stream(track, {
    sampleRate: 16000,
    numChannels: 1,
    frameSizeMs: 20,
  }).getReader();
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (!signal.aborted) {
      const frame = await reader.read();
      if (frame.done || signal.aborted) break;
      feed(new Int16Array(frame.value.data));
    }
  } finally {
    ended.abort();
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
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
  const issues = new Map<string, string>();
  const archive = new MeetingArchive(id, epoch, issues);
  const radio = new RadioMeeting(
    (room, name, publisher, stop) =>
      openPcmTrack(rtcSdk, room, name, 24000, stop, publisher),
    issues,
    undefined,
    archive,
  );
  const b: Bridge = {
    rtc,
    epoch,
    connected: Promise.resolve(),
    stop: new AbortController(),
    archive,
    issues,
    inputs: new Map(),
    radio,
    speaking: new Map(),
    listeners: new Map(),
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
  rtc.on(RoomEvent.ParticipantDisconnected, (participant) => {
    b.listeners.get(participant.identity)?.abort();
    b.listeners.delete(participant.identity);
    b.inputs.get(participant.identity)?.abort();
    emptyTimer();
  });
  rtc.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
    if (track.sid === inputSids.get(participant.identity))
      b.inputs.get(participant.identity)?.abort();
  });
  const inputSids = new Map<string, string>();
  rtc.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
    if (
      pub.source !== rtcSdk.TrackSource.SOURCE_MICROPHONE ||
      track.kind !== rtcSdk.TrackKind.KIND_AUDIO ||
      !track.sid ||
      participant.identity === "interpreter" ||
      b.inputs.has(participant.identity)
    )
      return;
    const input = new AbortController();
    b.inputs.set(participant.identity, input);
    inputSids.set(participant.identity, track.sid);
    const live = radioInput(
      b,
      participant.identity,
      track,
      AudioStream,
      input.signal,
    ).catch(() => {
      if (!input.signal.aborted)
        b.issues.set(
          participant.identity,
          "Live input interrupted. Rejoin meeting audio.",
        );
    });
    void live.finally(() => {
      input.abort();
      if (b.inputs.get(participant.identity) === input) {
        b.inputs.delete(participant.identity);
        inputSids.delete(participant.identity);
      }
    });
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
export async function joinMeeting(id: string, person: string) {
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
  const current = await roomState(db.query, id, person);
  if (
    !current.canRecord ||
    current.room.media_epoch !== b.epoch ||
    b.stop.signal.aborted
  )
    throw new Problem(
      409,
      "MEETING_CHANGED",
      "Meeting audio changed. Rejoin to continue.",
    );
  const room = ["sahva-output", id, b.epoch, person, randomUUID()].join("-");
  const outputToken = await outputCredential(room, person, false);
  b.stop.signal.throwIfAborted();
  b.listeners.get(person)?.abort();
  const listener = new AbortController();
  b.listeners.set(person, listener);
  b.radio.listen(person, current.me.listening, room, listener.signal);
  b.speaking.set(person, current.me.speaking);
  return {
    outputToken,
    url: process.env.LIVEKIT_URL,
    token: await credential(id, b.epoch, person, false),
  };
}
