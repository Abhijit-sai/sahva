import WebSocket from "ws";
import { z } from "zod";
export const model = "gemini-3.5-live-translate-preview";
import { geminiCode } from "../meeting-languages.ts";
type Lang = ReturnType<typeof geminiCode>;
const names = new Intl.DisplayNames(["en"], {type:"language"});
const transcript = z.object({
  text: z.string().optional(),
  finished: z.boolean().optional(),
  languageCode: z.string().optional(),
});
const googleEvent = z.object({
  setupComplete: z.object({}).optional(),
  goAway: z.object({}).optional(),
  error: z.object({ code: z.number().optional() }).optional(),
  usageMetadata: z.record(z.string(), z.unknown()).optional(),
  serverContent: z
    .object({
      inputTranscription: transcript.optional(),
      outputTranscription: transcript.optional(),
      turnComplete: z.boolean().optional(),
      interrupted: z.boolean().optional(),
      modelTurn: z
        .object({
          parts: z.array(
            z.object({
              inlineData: z
                .object({ mimeType: z.string(), data: z.base64() })
                .optional(),
            }),
          ),
        })
        .optional(),
    })
    .optional(),
});
export type Hooks = {
  text: (
    side: "source" | "target",
    text: string,
    final?: boolean,
    language?: string,
    segment?: string,
  ) => void;
  audio: (bytes: Buffer, format: "pcm" | "wav") => void;
  event: (name: string) => void;
  usage: (value: Record<string, unknown>) => void;
};

export async function gemini(
  source: Lang,
  target: Lang,
  hooks: Hooks,
  options: {
    hintSourceLanguage?: boolean;
    echoTargetLanguage?: boolean;
    reportingPeriods?: boolean;
    conversation?: boolean;
    continuous?: boolean;
    signal?: AbortSignal;
  } = {},
) {
  const key = process.env.GEMINI_API_KEY;
  options.signal?.throwIfAborted();
  if (options.continuous && process.env.SAHVA_OFFLINE_TEST === "1")
    throw Error("Live interpreter disabled during offline testing");
  if (!key?.trim()) throw Error("Missing GEMINI_API_KEY");
  if (process.env.GEMINI_LIVE_MODEL && process.env.GEMINI_LIVE_MODEL !== model)
    throw Error(
      "Configured model differs from the requested dedicated preview",
    );
  const socket = new WebSocket(
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent",
    {
      headers: { "x-goog-api-key": key },
      handshakeTimeout: 10000,
      maxPayload: 2_000_000,
    },
  );
  const ready = Promise.withResolvers<void>();
  const abort = () => socket.terminate();
  options.signal?.addEventListener("abort", abort, { once: true });
  socket.once("close", () =>
    options.signal?.removeEventListener("abort", abort),
  );
  let audioBytes = 0;
  let failure: Error | undefined;

  const fail = (reason: string) => {
    failure ??= Error(reason);
    ready.reject(failure);
  };
  const send = (packet: object) => {
    if (failure) throw failure;
    if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 128000)
      throw Error("Stream interrupted or input backed up");
    socket.send(JSON.stringify(packet));
  };
  socket.on("error", () => fail("Provider WebSocket transport failed"));
  socket.on("unexpected-response", (req, res) => {
    fail("WebSocket handshake HTTP " + res.statusCode);
    res.destroy();
    req.destroy();
  });
  socket.on("close", (code) => fail("Provider closed WebSocket " + code));
  socket.on("open", () => {
    const direction =
      source === "te" && target === "en"
        ? "The speaker is speaking Telugu, sometimes with English words. Interpret the utterance into English, preserving names, numbers and intent."
        : source === "en" && target === "te"
          ? "The speaker is speaking English, sometimes with Telugu words. Interpret the utterance into Telugu, preserving names, numbers and intent."
          : `Interpret spoken ${names.of(source)} into ${names.of(target)}, preserving names, numbers and intent.`;
    const instructions = [direction];
    if (options.reportingPeriods)
      instructions.push(
        "Preserve which reporting period is being compared with which. Keep each figure attached to its period. Use natural spoken Telugu for a business meeting.",
      );
    if (options.conversation)
      instructions.push(
        "Interpret in natural spoken clauses. Omit empty hesitation and repeated listening sounds only when their function is clear.",
        "Preserve a short reply when it answers, agrees, refuses, questions, expresses surprise or changes the meaning. When uncertain, preserve it.",
        "Across a hesitation, carry an unfinished thought forward until its meaning is clear. Preserve uncertainty, negation, conditions, corrections, quantities, units, and the speaker's emphasis. Keep code-switched names and technical terms recognizable.",
      );
    send({
      setup: {
        model: "models/" + model,
        ...(options.hintSourceLanguage
          ? {
              systemInstruction: { parts: [{ text: instructions.join(" ") }] },
            }
          : {}),
        inputAudioTranscription: options.hintSourceLanguage
          ? { languageCodes: [source] }
          : {},
        outputAudioTranscription: {},
        generationConfig: {
          responseModalities: ["AUDIO"],
          translationConfig: {
            targetLanguageCode: target,
            echoTargetLanguage: options.echoTargetLanguage ?? false,
          },
        },
      },
    });
  });
  socket.on("message", (raw) => {
    try {
      const msg: unknown = JSON.parse(raw.toString());
      const item = googleEvent.parse(msg);
      if (item.error)
        return fail("Gemini API error " + (item.error.code ?? "unknown"));
      if (item.goAway) return fail("Gemini GoAway during short trial");
      if (item.setupComplete) ready.resolve();
      if (item.usageMetadata) hooks.usage(item.usageMetadata);
      const c = item.serverContent;
      if (!c) return;
      for (const [side, t] of [
        ["source", c.inputTranscription],
        ["target", c.outputTranscription],
      ] as const)
        if (t) hooks.text(side, t.text ?? "", t.finished, t.languageCode);
      if (c.interrupted) hooks.event("interrupted");
      if (c.turnComplete) hooks.event("turnComplete");
      for (const part of c.modelTurn?.parts ?? []) {
        const bin = part.inlineData;
        if (!bin) continue;
        if (!/^audio\/pcm(?:;\s*rate=24000)?$/i.test(bin.mimeType))
          return fail("Unexpected output format");
        const pcm = Buffer.from(bin.data, "base64");

        audioBytes += pcm.length;
        if (
          !pcm.length ||
          pcm.length % 2 ||
          (!options.continuous && audioBytes > 3_000_000)
        )
          return fail("Invalid or excessive translated audio");
        hooks.audio(pcm, "pcm");
      }
    } catch {
      fail("Invalid provider event or output");
    }
  });
  const opening = setTimeout(() => fail("Session setup timed out"), 12000);
  try {
    await ready.promise;
  } catch (e) {
    socket.terminate();
    throw e;
  } finally {
    clearTimeout(opening);
  }
  return {
    feed(pcm: Buffer) {
      const audio = pcm.toString("base64");
      send({
        realtimeInput: {
          audio: { data: audio, mimeType: "audio/pcm;rate=16000" },
        },
      });
    },
    check() {
      if (failure) throw failure;
    },
    async finish() {
      send({ realtimeInput: { audioStreamEnd: true } });
    },
    close() {
      socket.terminate();
    },
  };
}
