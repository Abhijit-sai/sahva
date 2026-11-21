import { randomUUID } from "node:crypto";
import { addAbortListener } from "node:events";
import { AccessToken } from "livekit-server-sdk";
import type * as RTC from "@livekit/rtc-node";
import { SarvamSpeech } from "../providers/sarvam.ts";
import type { Language } from "../shared.ts";
import { voices, supportsVoice } from "../voices.ts";

export type SourceSegment = {
  roomId: string;
  epoch: number;
  speaker: string;
  trackSid: string;
  clockEpoch: string;
  startSample: number;
  segmentId: string;
  sourceRevision: 0;
  language: Language;
  samples: number;
  text: string;
  original: Buffer;
};
type Output = {
  room: string;
  member: string;
  target: Language;
  voice: string;
  stop: AbortController;
  pending: number;
  tail: Promise<void>;
  translating: boolean;
};

export async function outputCredential(
  room: string,
  identity: string,
  publisher: boolean,
) {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity, ttl: "2m" },
  );
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: publisher,
    canSubscribe: !publisher,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return token.toJwt();
}

// Network reads can split a sample. Emit complete 20 ms mono PCM16 frames with bounded carry.
export async function* pcmFrames(
  body: ReadableStream<Uint8Array>,
  rate: number,
  signal: AbortSignal,
) {
  const reader = body.getReader();
  const frameBytes = (rate / 50) * 2;
  let pending = Buffer.alloc(0);
  let total = 0;
  const abort = addAbortListener(signal, () => {
    void reader.cancel().catch(() => {});
  });
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > rate * 2 * 45) throw Error("OUTPUT_TOO_LONG");
      const bytes = Buffer.concat([pending, value]);
      let offset = 0;
      while (bytes.length - offset >= frameBytes) {
        signal.throwIfAborted();
        yield new Int16Array(
          Uint8Array.from(bytes.subarray(offset, offset + frameBytes)).buffer,
        );
        offset += frameBytes;
      }
      pending = Buffer.from(bytes.subarray(offset));
    }
    signal.throwIfAborted();
    if (!total || total % 2) throw Error("INCOMPLETE_PCM");
    if (pending.length) {
      const tail = new Uint8Array(frameBytes);
      tail.set(pending);
      yield new Int16Array(tail.buffer);
    }
  } finally {
    abort[Symbol.dispose]();
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function subscribed(
  publication: RTC.LocalTrackPublication,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  let cancel!: () => void;
  const stopped = new Promise<never>((_, reject) => {
    cancel = () => reject(Error("SUBSCRIPTION_STOPPED"));
  });
  const abort = addAbortListener(signal, cancel);
  try {
    await Promise.race([publication.waitForSubscription(), stopped]);
  } finally {
    abort[Symbol.dispose]();
  }
}

export async function openPcmTrack(
  sdk: typeof RTC,
  room: string,
  name: string,
  rate: number,
  signal: AbortSignal,
) {
  const rtc = new sdk.Room();
  const source = new sdk.AudioSource(rate, 1, 100);
  const track = sdk.LocalAudioTrack.createAudioTrack(name, source);
  const abort = addAbortListener(signal, () => {
    source.clearQueue();
    void rtc.disconnect().catch(() => {});
  });
  async function close() {
    abort[Symbol.dispose]();
    await rtc.disconnect().catch(() => {});
    await track.close(true);
  }
  try {
    signal.throwIfAborted();
    const token = await outputCredential(room, "interpretation", true);
    await rtc.connect(process.env.LIVEKIT_URL!, token, {
      autoSubscribe: false,
      dynacast: false,
    });
    signal.throwIfAborted();
    const publication = await rtc.localParticipant!.publishTrack(
      track,
      new sdk.TrackPublishOptions(),
    );
    await subscribed(
      publication,
      AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    );
    return {
      async write(samples: Int16Array) {
        signal.throwIfAborted();
        await source.captureFrame(
          new sdk.AudioFrame(samples, rate, 1, samples.length),
        );
      },
      drain: () => source.waitForPlayout(),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export class MeetingOutputs {
  private outputs = new Map<string, Output>();
  private lastSegment = new Map<
    string,
    { clockEpoch: string; endSample: number }
  >();
  private readonly roomId: string;
  private readonly epoch: number;
  private readonly sdk: typeof RTC;
  private readonly issues: Map<string, string>;
  constructor(
    roomId: string,
    epoch: number,
    sdk: typeof RTC,
    issues: Map<string, string>,
  ) {
    this.roomId = roomId;
    this.epoch = epoch;
    this.sdk = sdk;
    this.issues = issues;
  }

  async join(member: string, target: Language, requestedVoice?: string) {
    this.leave(member);
    const room = [
      "sahva-output",
      this.roomId,
      this.epoch,
      member,
      randomUUID(),
    ].join("-");
    const out = {
      room,
      member,
      target,
      voice: supportsVoice(target, requestedVoice)
        ? requestedVoice
        : target === "te-IN"
          ? "tarun_te_narration"
          : voices[target][0].id,
      pending: 0,
      tail: Promise.resolve(),
      translating: false,
      stop: new AbortController(),
    };
    this.outputs.set(member, out);
    return outputCredential(room, member, false);
  }
  leave(member: string) {
    this.outputs.get(member)?.stop.abort();
    this.outputs.delete(member);
  }
  close() {
    for (const member of this.outputs.keys()) this.leave(member);
  }
  state(member: string) {
    const out = this.outputs.get(member);
    if (!out) return;
    if (out.pending > 1) return "Catching up";
    if (out.translating) return "Translating";
  }
  defer(speaker: string) {
    for (const out of this.outputs.values())
      if (out.member !== speaker)
        this.issues.set(
          out.member,
          "Catch up in the timeline. This phrase is available for review after processing.",
        );
  }
  dispatch(segment: SourceSegment, trackStop: AbortSignal) {
    if (
      segment.roomId !== this.roomId ||
      segment.epoch !== this.epoch ||
      trackStop.aborted
    )
      return;
    const last = this.lastSegment.get(segment.speaker);
    if (
      last?.clockEpoch === segment.clockEpoch &&
      segment.startSample < last.endSample
    )
      return;
    this.lastSegment.set(segment.speaker, {
      clockEpoch: segment.clockEpoch,
      endSample: segment.startSample + segment.samples,
    });
    const groups = new Map<string, Output[]>();
    for (const out of this.outputs.values()) {
      if (out.member === segment.speaker) continue;
      if (out.pending >= 3) {
        this.issues.set(
          out.member,
          "Catching up. A new phrase arrived during interpretation. Review it in the timeline.",
        );
        continue;
      }
      out.pending++;
      const key = out.target + "/" + out.voice;
      const group = groups.get(key) ?? [];
      group.push(out);
      groups.set(key, group);
    }
    const committed = performance.now();
    for (const group of groups.values()) {
      const next = Promise.all(group.map((out) => out.tail))
        .then(async () => {
          const eligible = group.filter((out) => !out.stop.signal.aborted);
          if (!eligible.length || trackStop.aborted) return;
          if (performance.now() - committed > 15000) {
            for (const out of eligible)
              this.issues.set(
                out.member,
                "Catching up. An older phrase is available in the timeline.",
              );
            return;
          }
          await this.deliver(eligible, segment, trackStop);
        })
        .finally(() => {
          for (const out of group) out.pending--;
        });
      for (const out of group) out.tail = next;
    }
  }
  private async deliver(
    group: Output[],
    s: SourceSegment,
    trackStop: AbortSignal,
  ) {
    const { target, voice } = group[0];
    const original = target === s.language;
    const rate = original ? 16000 : 24000;
    const name = [
      target,
      s.speaker,
      s.segmentId,
      s.trackSid,
      s.clockEpoch,
      s.startSample,
      s.startSample + s.samples,
      s.sourceRevision,
      original ? "original" : voice,
    ].join("/");
    const deadline = AbortSignal.any([trackStop, AbortSignal.timeout(45000)]);
    const channels = new Map<
      Output,
      Awaited<ReturnType<typeof openPcmTrack>>
    >();
    const noListeners = new AbortController();
    const allGone = () => {
      if (group.every((out) => out.stop.signal.aborted)) noListeners.abort();
    };
    const listeners = group.map((out) =>
      addAbortListener(out.stop.signal, allGone),
    );
    const signal = AbortSignal.any([deadline, noListeners.signal]);
    const failed = (out: Output) => {
      if (this.outputs.get(out.member) === out)
        this.issues.set(
          out.member,
          "Live voice interrupted. Captions and replay are available in the timeline after processing.",
        );
    };
    try {
      await Promise.all(
        group.map(async (out) => {
          try {
            const channel = await openPcmTrack(
              this.sdk,
              out.room,
              name,
              rate,
              AbortSignal.any([signal, out.stop.signal]),
            );
            channels.set(out, channel);
          } catch {
            failed(out);
          }
        }),
      );
      signal.throwIfAborted();
      if (!channels.size) return;
      let body: ReadableStream<Uint8Array>;
      if (original) {
        body = new ReadableStream({
          start(controller) {
            controller.enqueue(s.original);
            controller.close();
          },
        });
      } else {
        for (const out of channels.keys()) out.translating = true;
        const speech = new SarvamSpeech(process.env.SARVAM_API_KEY!);
        const translation = await speech.translate(
          s.text,
          s.language,
          target,
          "sarvam-translate:v1",
          signal,
        );
        body = await speech.streamPcm(translation.text, target, voice, signal);
        for (const out of channels.keys()) out.translating = false;
      }
      for await (const frame of pcmFrames(body, rate, signal)) {
        await Promise.all(
          Array.from(channels, async ([out, channel]) => {
            try {
              await channel.write(frame);
            } catch {
              channels.delete(out);
              await channel.close();
              failed(out);
            }
          }),
        );
        if (!channels.size) return;
      }
      await Promise.all(Array.from(channels.values(), (ch) => ch.drain()));
    } catch {
      group.forEach(failed);
    } finally {
      for (const out of group) out.translating = false;
      for (const listener of listeners) listener[Symbol.dispose]();
      await Promise.allSettled(
        Array.from(channels.values(), (ch) => ch.close()),
      );
    }
  }
}
