import { describe, expect, it, vi } from "vitest";
import { pcmFrames } from "../lib/server/interpretation-output";
import { SarvamSpeech } from "../lib/providers/sarvam";

describe("progressive interpretation", () => {
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
  it("keeps the fallback by default and honors an optional room restriction", async () => {
    const { interpretedRoom } = await import(
      "../lib/server/interpretation-flag"
    );
    try {
      vi.stubEnv("SAHVA_LIVE_MEDIA_INTERPRETATION", "");
      vi.stubEnv("SAHVA_LIVE_MEDIA_ROOM_ID", "");
      expect(interpretedRoom("a")).toBe(false);
      vi.stubEnv("SAHVA_LIVE_MEDIA_INTERPRETATION", "1");
      expect(interpretedRoom("a")).toBe(true);
      vi.stubEnv("SAHVA_LIVE_MEDIA_ROOM_ID", "b");
      expect(interpretedRoom("a")).toBe(false);
      expect(interpretedRoom("b")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
