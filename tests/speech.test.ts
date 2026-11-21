import { describe, expect, it, vi } from "vitest";
import { SarvamSpeech, SpeechError } from "../lib/providers/sarvam.ts";

const json = (data: unknown) => Response.json(data);
const wav = Buffer.alloc(48);
wav.write("RIFF");
wav.write("WAVE", 8);
wav.write("data", 36);
wav.writeUInt32LE(4, 40);
const clip = new File([wav], "turn.wav", { type: "audio/wav" });

describe("Sarvam transport contracts (simulated responses)", () => {
  it.each([
    ["te-IN", "en-IN"],
    ["en-IN", "te-IN"],
  ] as const)(
    "sends %s through all three stages to %s",
    async (source, target) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          json({
            request_id: "s1",
            transcript: "fixture",
            language_code: source,
          }),
        )
        .mockResolvedValueOnce(
          json({
            request_id: "m1",
            translated_text: "translated fixture",
            source_language_code: source,
          }),
        )
        .mockResolvedValueOnce(
          json({ request_id: "t1", audios: [wav.toString("base64")] }),
        );
      const provider = new SarvamSpeech("test-only", send);
      const stt = await provider.transcribe(clip);
      const mt = await provider.translate(stt.text, stt.language, target);
      const tts = await provider.synthesize(mt.text, target);
      expect(tts.audio).toEqual(wav);
      const urls = send.mock.calls.map((call) => String(call[0]));
      expect(urls).toEqual(
        ["speech-to-text", "translate", "text-to-speech"].map(
          (p) => "https://api.sarvam.ai/" + p,
        ),
      );
      const body = send.mock.calls[0][1]?.body as FormData;
      expect(body.get("model")).toBe("saaras:v4");
      expect(body.get("language_code")).toBe("unknown");
      expect(body.get("file")).toBeInstanceOf(Blob);
      expect(JSON.parse(String(send.mock.calls[1][1]?.body))).toMatchObject({
        model: "mayura:v1",
        source_language_code: source,
        target_language_code: target,
      });
      const request = JSON.parse(String(send.mock.calls[2][1]?.body));
      expect(request.pace).toBe(target === "te-IN" ? 1.2 : undefined);
      expect(request.pitch).toBe(target === "te-IN" ? -0.1 : undefined);
      expect(request).toMatchObject({
        model: "bulbul:v4-flash",
        language_code: target,
        output_audio_codec: "wav",
      });
    },
  );

  it.each([
    { transcript: " ", language_code: "te-IN" },
    { transcript: "text", language_code: "hi-IN" },
  ])("rejects empty or unsupported ASR", async (data) => {
    await expect(
      new SarvamSpeech("test-only", async () =>
        json({ ...data, request_id: "s1" }),
      ).transcribe(clip),
    ).rejects.toBeInstanceOf(SpeechError);
  });
  it("returns a stage and safe status without echoing a provider error body", async () => {
    const provider = new SarvamSpeech(
      "test-only",
      async () => new Response("private transcript", { status: 429 }),
    );
    await expect(provider.synthesize("fixture", "en-IN")).rejects.toMatchObject(
      { stage: "tts", code: "HTTP_429", message: "tts: HTTP_429" },
    );
  });
  it("rejects encoded data that is not a playable WAV", async () => {
    const provider = new SarvamSpeech("test-only", async () =>
      json({ request_id: "t1", audios: ["dGV4dA=="] }),
    );
    await expect(
      provider.synthesize("fixture", "te-IN"),
    ).rejects.toBeInstanceOf(SpeechError);
  });
  it("rejects a voice catalog mismatch before contacting the provider", async () => {
    const send = vi.fn<typeof fetch>();
    await expect(
      new SarvamSpeech("test-only", send).synthesize(
        "hello",
        "te-IN",
        "dev_en_conversational",
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_VOICE" });
    expect(send).not.toHaveBeenCalled();
  });
  it("enforces Mayura's character budget before calling the provider", async () => {
    const send = vi.fn<typeof fetch>();
    await expect(
      new SarvamSpeech("test-only", send).translate(
        "a".repeat(1001),
        "en-IN",
        "te-IN",
      ),
    ).rejects.toMatchObject({ stage: "translation" });
    expect(send).not.toHaveBeenCalled();
  });
});
