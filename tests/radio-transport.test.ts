import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it, vi } from "vitest";
import type { gemini } from "../lib/providers/gemini-interpretation";
import { meetingConsent } from "../lib/shared";

// Replace only the paid service. Both mic publishers, the worker and both listeners use RTC.
vi.mock("../lib/providers/gemini-interpretation.ts", () => {
  const translate: typeof gemini = async (source, target, hooks) => {
    const frequency = target === "en" ? 1200 : 1600;
    const samples = tone(frequency, 24000);
    let transcriptSent = false;
    return {
      feed(input) {
        if (!input.some((byte) => byte !== 0)) return;
        hooks.audio(Buffer.from(samples.buffer), "pcm");
        if (!transcriptSent) {
          hooks.text("source", source, true);
          hooks.text("target", target, true);
          transcriptSent = true;
        }
      },
      check() {},
      async finish() {},
      close() {},
    };
  };
  return { model: "gemini-3.5-live-translate-preview", gemini: translate };
});

function tone(hz: number, rate: number) {
  return Int16Array.from({ length: rate / 50 }, (_, i) =>
    Math.round(6500 * Math.sin((2 * Math.PI * i * hz) / rate)),
  );
}

function amplitude(samples: Int16Array, hz: number) {
  let re = 0,
    im = 0;
  for (let i = 0; i < samples.length; i++) {
    const phase = (2 * Math.PI * hz * i) / 24000;
    re += samples[i] * Math.cos(phase);
    im += samples[i] * Math.sin(phase);
  }
  return (2 * Math.hypot(re, im)) / samples.length;
}

it.runIf(process.env.SAHVA_RADIO_RTC_TEST === "1")(
  "decodes distinct simultaneous interpreted channels through the actual meeting worker",
  async () => {
    for (const [key, value] of Object.entries({
      SAHVA_LOCAL: "1",
      SAHVA_TEST_RUN: randomUUID(),
      SAHVA_OFFLINE_TEST: "1",
      SAHVA_LIVEKIT: "1",
      SAHVA_LIVE_MEDIA_INTERPRETATION: "1",
      LIVEKIT_URL: "ws://127.0.0.1:17880",
      LIVEKIT_API_KEY: "devkey",
      LIVEKIT_API_SECRET: "secret",
    }))
      vi.stubEnv(key, value);
    const rtc = await import("@livekit/rtc-node");
    const { enter } = await import("../lib/server/rooms");
    const { joinMeeting, radioCaptions, stopMeeting } =
      await import("../lib/server/meeting");
    const profile = {
      name: "Radio fixture",
      transport: "livekit",
      acceptedConsent: true,
      consentVersion: meetingConsent,
    };
    const a = await enter({
      ...profile,
      speakingLanguage: "te-IN",
      listeningLanguage: "te-IN",
    });
    const b = await enter(
      {
        ...profile,
        speakingLanguage: "en-IN",
        listeningLanguage: "en-IN",
        invite: a.invite,
      },
      a.id,
    );
    vi.stubEnv("SAHVA_GEMINI_RADIO_ROOM_ID", "unused-old-rehearsal-id");
    const seats = [a, b].map((seat, i) => {
      const source = new rtc.AudioSource(16000, 1, 100);
      return {
        ...seat,
        mic: new rtc.Room(),
        ears: new rtc.Room(),
        source,
        track: rtc.LocalAudioTrack.createAudioTrack("microphone", source),
        samples: tone(i ? 350 : 450, 16000),
        expected: i ? 1200 : 1600,
        other: i ? 1600 : 1200,
        matches: 0,
        leaks: 0,
        names: new Set<string>(),
      };
    });
    const readers: ReadableStreamDefaultReader<
      InstanceType<typeof rtc.AudioFrame>
    >[] = [];
    try {
      for (const seat of seats) {
        seat.ears.on(rtc.RoomEvent.TrackSubscribed, (track, publication) => {
          seat.names.add(publication.name ?? "");
          const reader = new rtc.AudioStream(track, {
            sampleRate: 24000,
            numChannels: 1,
            frameSizeMs: 20,
          }).getReader();
          readers.push(reader);
          void (async () => {
            for (;;) {
              const frame = await reader.read();
              if (frame.done) break;
              if (amplitude(frame.value.data, seat.expected) > 1200)
                seat.matches++;
              if (amplitude(frame.value.data, seat.other) > 1200) seat.leaks++;
            }
          })().catch(() => {});
        });
        const joined = await joinMeeting(a.id, seat.member);
        await seat.ears.connect(joined.url, joined.outputToken!, {
          autoSubscribe: true,
          dynacast: false,
        });
        await seat.mic.connect(joined.url, joined.token, {
          autoSubscribe: false,
          dynacast: false,
        });
        const opts = new rtc.TrackPublishOptions();
        opts.source = rtc.TrackSource.SOURCE_MICROPHONE;
        await seat.mic.localParticipant!.publishTrack(seat.track, opts);
      }
      for (let i = 0; i < 250 && seats.some((seat) => seat.matches < 20); i++) {
        await Promise.all(
          seats.map((seat) =>
            seat.source.captureFrame(
              new rtc.AudioFrame(seat.samples, 16000, 1, 320),
            ),
          ),
        );
        await delay(20);
      }
      for (const [i, seat] of seats.entries()) {
        const remote = seats[1 - i];
        expect(seat.names.size).toBe(1);
        expect([...seat.names][0]).toContain("/" + remote.member + "/");
        expect(seat.matches).toBeGreaterThanOrEqual(20);
        expect(seat.leaks).toBe(0);
        expect(radioCaptions(a.id, seat.member)).toMatchObject([
          { speaker: remote.member, translation: i ? "en" : "te" },
        ]);
      }
      await stopMeeting(a.id);
      const { meetingReplays, replayAudio } =
        await import("../lib/server/meeting-archive");
      for (const [i, seat] of seats.entries()) {
        const rows = await meetingReplays(a.id, seat.member);
        expect(rows.length).toBeGreaterThan(0);
        const row = rows[0];
        expect(row.speaker_id).toBe(seats[1 - i].member);
        const replay = await replayAudio(a.id, seat.member, String(row.id));
        const wav = Buffer.from(await replay.arrayBuffer());
        expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
        expect(wav.readUInt32LE(24)).toBe(24000);
        const samples = new Int16Array(
          Uint8Array.from(wav.subarray(44)).buffer,
        );
        expect(amplitude(samples, seat.expected)).toBeGreaterThan(1200);
        expect(amplitude(samples, seat.other)).toBeLessThan(1200);
        await expect(
          replayAudio(a.id, seats[1 - i].member, String(row.id)),
        ).rejects.toMatchObject({ status: 404 });
      }
    } finally {
      await stopMeeting(a.id);
      await Promise.allSettled(readers.map((reader) => reader.cancel()));
      await Promise.allSettled(
        seats.flatMap((seat) => [
          seat.mic.disconnect(),
          seat.ears.disconnect(),
        ]),
      );
      await Promise.allSettled(seats.map((seat) => seat.track.close(true)));
      vi.unstubAllEnvs();
    }
  },
  45000,
);
