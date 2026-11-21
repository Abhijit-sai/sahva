import { describe, expect, it, vi } from "vitest";
import {
  MeetingOutputs,
  pcmFrames,
  type SourceSegment,
} from "../lib/server/interpretation-output";
import { SarvamSpeech } from "../lib/providers/sarvam";

describe("progressive interpretation", () => {
  it("keeps committed voices and routes subsequent speech to each listener's chosen voice", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "test");
    vi.stubEnv("LIVEKIT_API_SECRET", "local-test-secret");
    vi.stubEnv("SARVAM_API_KEY", "test-fixture");
    const published: string[] = [];
    const sdk = {
      Room: class {
        connect() {}
        disconnect() {
          return Promise.resolve();
        }
        localParticipant = {
          publishTrack: ({ name }: { name: string }) => {
            published.push(name);
            return { waitForSubscription: () => Promise.resolve() };
          },
        };
      },
      AudioSource: class {
        captureFrame() {}
        waitForPlayout() {}
      },
      LocalAudioTrack: {
        createAudioTrack: (name: string) => ({ name, close() {} }),
      },
      TrackPublishOptions: class {},
      AudioFrame: class {},
    };
    // Stand in for native RTC and provider I/O while exercising the real queue and fanout.
    const outputs = new MeetingOutputs(
      "room",
      1,
      sdk as unknown as typeof import("@livekit/rtc-node"),
      new Map(),
    );
    const send = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).endsWith("/translate")
          ? Response.json({ translated_text: "fixture", request_id: "offline", source_language_code: "te-IN" })
          : new Response(new Uint8Array(960), {
              headers: { "content-type": "audio/pcm" },
            }),
      );
    vi.stubGlobal("fetch", send);
    try {
      const token = await outputs.join("a", "en-IN");
      await outputs.join("b", "en-IN");
      const room: string = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      ).video.room;
      const source: SourceSegment = {
        roomId: "room",
        epoch: 1,
        speaker: "speaker",
        trackSid: "mic",
        clockEpoch: "clock",
        startSample: 0,
        segmentId: "first",
        sourceRevision: 0,
        language: "te-IN",
        samples: 320,
        text: "fixture",
        original: Buffer.alloc(640),
      };
      const signal = new AbortController().signal;
      outputs.dispatch(source, signal);
      expect(outputs.changeVoice("b", room, "dev_en_conversational")).toBe(
        false,
      );
      expect(outputs.changeVoice("a", room, "tarun_te_narration")).toBe(false);
      expect(outputs.changeVoice("a", room, "dev_en_conversational")).toBe(
        true,
      );
      outputs.dispatch(
        { ...source, startSample: 320, segmentId: "second" },
        signal,
      );
      await vi.waitFor(() =>
        expect(
          send.mock.calls.filter(([url]) => String(url).endsWith("/stream")),
        ).toHaveLength(3),
      );
      const speakers = send.mock.calls
        .filter(([url]) => String(url).endsWith("/stream"))
        .map(([, init]) => JSON.parse(String(init?.body)).speaker);
      expect(speakers.sort()).toEqual([
        "dev_en_conversational",
        "simran_en_customer",
        "simran_en_customer",
      ]);
      expect(
        published
          .filter((name) => name.includes("/first/"))
          .map((name) => name.split("/").pop()),
      ).toEqual(["simran_en_customer", "simran_en_customer"]);
      expect(
        published
          .filter((name) => name.includes("/second/"))
          .map((name) => name.split("/").pop())
          .sort(),
      ).toEqual(["dev_en_conversational", "simran_en_customer"]);
      const logged = vi.spyOn(console, "info");
      try {
        outputs.decoded("b", room, "first");
        outputs.decoded("a", room, "unknown");
        outputs.decoded("a", room, "first");
        outputs.decoded("a", room, "first");
        expect(logged).toHaveBeenCalledTimes(1);
        expect(logged).toHaveBeenCalledWith("sahva.media", expect.objectContaining({event:"receiver_decoded", member:"a", segment:"first"}));
      } finally {
        logged.mockRestore();
      }
      await outputs.join("a", "en-IN");
      expect(outputs.changeVoice("a", room, "dev_en_conversational")).toBe(
        false,
      );
    } finally {
      outputs.close();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  it("yields before EOF, preserves split samples and pads only the final frame", async () => {
    let input!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        input = c;
      },
    });
    const frames = pcmFrames(body, 24000, new AbortController().signal);
    input.enqueue(Uint8Array.of(0x34));
    const chunk = new Uint8Array(961);
    chunk[0] = 0x12;
    chunk[959] = 8;
    input.enqueue(chunk);
    const first = (await frames.next()).value as Int16Array;
    expect(first).toHaveLength(480);
    expect(first[0]).toBe(0x1234);
    input.close();
    const last = (await frames.next()).value as Int16Array;
    expect(last[0]).toBe(8);
    expect(last.slice(1).every((n) => n === 0)).toBe(true);
    expect((await frames.next()).done).toBe(true);
  });
  it("rejects a truncated sample and cancels an in-flight read on revoke", async () => {
    const truncated = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(Uint8Array.of(1));
        c.close();
      },
    });
    await expect(
      pcmFrames(truncated, 24000, new AbortController().signal).next(),
    ).rejects.toThrow("INCOMPLETE_PCM");
    const stopped = new AbortController();
    const cancel = vi.fn();
    const pending = pcmFrames(
      new ReadableStream({ cancel }),
      24000,
      stopped.signal,
    ).next();
    stopped.abort();
    await expect(pending).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("requests the actual target voice and refuses a container in place of raw PCM", async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("fixture", { headers: { "content-type": "audio/wav" } }),
      );
    const speech = new SarvamSpeech("test-only", send);
    await expect(
      speech.streamPcm(
        "fixture",
        "te-IN",
        "tarun_te_narration",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "INVALID_PCM_RESPONSE" });
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toMatchObject({
      language_code: "te-IN",
      speaker: "tarun_te_narration",
      output_audio_codec: "linear16",
      speech_sample_rate: 24000,
    });
  });
});

describe("server rollout", () => {
  it("uses the Gemini meeting route for every enabled group room", async () => {
    const { interpretedRoom } =
      await import("../lib/server/interpretation-flag");
    try {
      vi.stubEnv("SAHVA_LIVEKIT", "");
      vi.stubEnv("SAHVA_LIVE_MEDIA_ROOM_ID", "");
      expect(interpretedRoom()).toBe(false);
      vi.stubEnv("SAHVA_LIVEKIT", "1");
      expect(interpretedRoom()).toBe(true);
      vi.stubEnv("SAHVA_LIVE_MEDIA_ROOM_ID", "b");
      expect(interpretedRoom()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
