import { Buffer } from "node:buffer";
import { z } from "zod";
import { voices, supportsVoice } from "../voices.ts";

import { roomLanguages } from "../shared.ts";
const language = z.enum(roomLanguages);
export type Language = z.infer<typeof language>;
export type Stage = "stt" | "translation" | "tts";

const receipt = z.object({
  request_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
});
const transcription = receipt.extend({
  transcript: z.string(),
  language_code: z.string().nullable(),
});
const translation = receipt.extend({
  translated_text: z.string().trim().min(1),
  source_language_code: language,
});
const speech = receipt.extend({
  audios: z.tuple([z.base64().max(10_000_000)]),
});

export class SpeechError extends Error {
  readonly stage: Stage;
  readonly code: string;

  constructor(stage: Stage, code: string) {
    super(stage + ": " + code);
    this.stage = stage;
    this.code = code;
  }
}

export class SarvamSpeech {
  #key: string;
  #send: typeof fetch;

  constructor(key: string, send: typeof fetch = fetch) {
    if (!key.trim()) throw new Error("SARVAM_API_KEY is required");
    this.#key = key;
    this.#send = send;
  }

  async #post<T>(
    stage: Stage,
    path: string,
    body: FormData | Record<string, string | number>,
    schema: z.ZodType<T>,
    stop?: AbortSignal,
  ) {
    const headers = new Headers({ "api-subscription-key": this.#key });
    const multipart = body instanceof FormData;
    if (!multipart) headers.set("Content-Type", "application/json");
    const start = performance.now();
    const deadline = AbortSignal.timeout(20_000);
    const signal = stop ? AbortSignal.any([deadline, stop]) : deadline;
    try {
      const response = await this.#send("https://api.sarvam.ai/" + path, {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers,
        signal,
        body: multipart ? body : JSON.stringify(body),
      });
      if (!response.ok) throw new SpeechError(stage, "HTTP_" + response.status);
      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) throw new SpeechError(stage, "INVALID_RESPONSE");
      return {
        data: parsed.data,
        elapsedMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      if (error instanceof SpeechError) throw error;
      throw new SpeechError(
        stage,
        signal.aborted
          ? "TIMEOUT"
          : error instanceof SyntaxError
            ? "INVALID_RESPONSE"
            : "CONNECTION_FAILED",
      );
    }
  }

  async transcribe(file: File) {
    const form = new FormData();
    form.set("file", file);
    form.set("model", "saaras:v4");
    form.set("mode", "transcribe");
    form.set("language_code", "unknown");
    const { data, elapsedMs } = await this.#post(
      "stt",
      "speech-to-text",
      form,
      transcription,
    );
    const text = data.transcript.trim();
    if (!text) throw new SpeechError("stt", "NO_SPEECH");
    const recognized = language.safeParse(data.language_code);
    if (!recognized.success)
      throw new SpeechError("stt", "UNSUPPORTED_LANGUAGE");
    return {
      text,
      language: recognized.data,
      requestId: data.request_id,
      elapsedMs,
    };
  }

  async translate(
    text: string,
    source: Language,
    target: Language,
    model: "mayura:v1" | "sarvam-translate:v1" = "mayura:v1",
    signal?: AbortSignal,
  ) {
    if (!text.trim() || Array.from(text).length > 1000)
      throw new SpeechError("translation", "TEXT_LENGTH");
    const { data, elapsedMs } = await this.#post(
      "translation",
      "translate",
      {
        model,
        input: text,
        source_language_code: source,
        target_language_code: target,
      },
      translation,
      signal,
    );
    if (data.source_language_code !== source)
      throw new SpeechError("translation", "LANGUAGE_MISMATCH");
    return {
      text: data.translated_text,
      requestId: data.request_id,
      elapsedMs,
    };
  }

  async streamPcm(text: string, target: Language, speaker: string, signal: AbortSignal) {
    if (!supportsVoice(target, speaker) || !text.trim() || Array.from(text).length > 3500)
      throw new SpeechError("tts", "INVALID_INPUT");
    const response = await this.#send("https://api.sarvam.ai/text-to-speech/stream", {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { "api-subscription-key": this.#key, "content-type": "application/json" },
      body: JSON.stringify({
        model: "bulbul:v4-flash", speaker, language_code: target, text,
        ...(target === "te-IN" ? { pace: 1.2, pitch: -0.1 } : {}),
        output_audio_codec: "linear16", speech_sample_rate: 24000,
      }),
    });
    if (!response.ok || !response.body || response.headers.get("content-type")?.split(";")[0] !== "audio/pcm") {
      await response.body?.cancel();
      throw new SpeechError("tts", "INVALID_PCM_RESPONSE");
    }
    return response.body;
  }

  async synthesize(
    text: string,
    target: Language,
    speaker: string = voices[target][0].id,
  ) {
    if (!supportsVoice(target, speaker))
      throw new SpeechError("tts", "UNSUPPORTED_VOICE");
    if (!text.trim() || Array.from(text).length > 2500)
      throw new SpeechError("tts", "TEXT_LENGTH");
    const { data, elapsedMs } = await this.#post(
      "tts",
      "text-to-speech",
      {
        model: "bulbul:v4-flash",
        speaker,
        ...(target === "te-IN" ? { pace: 1.2, pitch: -0.1 } : {}),
        text,
        language_code: target,
        output_audio_codec: "wav",
      },
      speech,
    );
    const audio = Buffer.from(data.audios[0], "base64");
    if (
      audio.length <= 44 ||
      audio.toString("ascii", 0, 4) !== "RIFF" ||
      audio.toString("ascii", 8, 12) !== "WAVE"
    ) {
      throw new SpeechError("tts", "INVALID_WAV");
    }
    return {
      audio,
      speaker,
      requestId: data.request_id,
      elapsedMs,
    };
  }
}
