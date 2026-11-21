import { audioDuration } from "../lib/server/audio.ts";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  SarvamSpeech,
  SpeechError,
  type Language,
} from "../lib/providers/sarvam.ts";

const types: Record<string, string> = {
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
};
const usage =
  "npm run smoke:speech -- --telugu <clip> --english <clip> --consented";
class InputError extends Error {}

async function loadClip(path: string, source: Language) {
  const extension = extname(path).toLowerCase();
  if (!types[extension])
    throw new InputError(source + " clip needs WebM, Ogg, MP4/M4A, or WAV.");
  const info = await stat(path).catch(() => null);
  if (!info?.isFile() || !info.size || info.size > 4_000_000)
    throw new InputError(source + " clip missing, empty, or over 4 MB.");
  const bytes = await readFile(path);
  const duration = await audioDuration(bytes, types[extension]).catch(() => {
    throw new InputError(
      source +
        " clip cannot be decoded. Confirm the format and FFmpeg installation.",
    );
  });
  if (duration < 500 || duration > 30_000)
    throw new InputError(
      source +
        " clip must contain 0.5–30 seconds of audio. Aim for 8–10 seconds.",
    );
  return {
    source,
    duration,
    file: new File([new Uint8Array(bytes)], "turn" + extension, {
      type: types[extension],
    }),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      telugu: { type: "string" },
      english: { type: "string" },
      consented: { type: "boolean" },
      "check-only": { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      usage +
        "\nAdd --check-only to validate both files locally without contacting a provider.",
    );
    return;
  }
  const key = process.env.SARVAM_API_KEY?.trim();
  const missing: string[] = [];
  if (!values["check-only"] && !key) missing.push("SARVAM_API_KEY");
  if (!values.telugu) missing.push("--telugu <clip>");
  if (!values.english) missing.push("--english <clip>");
  if (!values["check-only"] && !values.consented)
    missing.push(
      "--consented (both speakers agreed to external AI processing)",
    );
  if (missing.length)
    throw new InputError(
      "Missing " + missing.join(", ") + ". No provider calls made.\n" + usage,
    );
  const clips = [
    await loadClip(values.telugu!, "te-IN"),
    await loadClip(values.english!, "en-IN"),
  ];
  if (values["check-only"]) {
    for (const clip of clips)
      console.log(
        clip.source,
        clip.file.type,
        clip.duration + " ms",
        "local decode passed",
      );
    return;
  }
  const provider = new SarvamSpeech(key!);
  const root = ".sahva";
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(join(root, "speech-"));
  const evidence: object[] = [];
  let failed = false;
  for (const { source, file, duration } of clips) {
    const target: Language = source === "te-IN" ? "en-IN" : "te-IN";
    const steps: object[] = [];
    const run = {
      source,
      target,
      durationMs: duration,
      mime: file.type,
      steps,
      error: null as string | null,
    };
    try {
      const stt = await provider.transcribe(file);
      steps.push({
        stage: "stt",
        recognizedLanguage: stt.language,
        requestId: stt.requestId,
        elapsedMs: stt.elapsedMs,
      });
      if (stt.language !== source)
        throw new SpeechError("stt", "EXPECTED_LANGUAGE_MISMATCH");
      const mt = await provider.translate(stt.text, source, target);
      steps.push({
        stage: "translation",
        requestId: mt.requestId,
        elapsedMs: mt.elapsedMs,
      });
      await writeFile(
        join(folder, target + "-private-review.json"),
        JSON.stringify(
          { sourceText: stt.text, translatedText: mt.text },
          null,
          2,
        ),
      );
      const voice = await provider.synthesize(mt.text, target);
      const voiceDurationMs = await audioDuration(voice.audio, "audio/wav");
      if (!voiceDurationMs) throw new SpeechError("tts", "EMPTY_AUDIO");
      await writeFile(join(folder, target + ".wav"), voice.audio);
      steps.push({
        stage: "tts",
        speaker: voice.speaker,
        requestId: voice.requestId,
        elapsedMs: voice.elapsedMs,
        decodedDurationMs: voiceDurationMs,
      });
    } catch (error) {
      failed = true;
      run.error =
        error instanceof SpeechError || error instanceof InputError
          ? error.message
          : "Local review file operation failed";
    }
    evidence.push(run);
    console.log(JSON.stringify(run));
    await writeFile(
      join(folder, "evidence.json"),
      JSON.stringify(evidence, null, 2),
    );
  }
  console.log("Private review directory", folder);
  if (failed) process.exitCode = 1;
  else
    console.log(
      "Both provider paths returned decodable audio. Listen to both WAV files and review the text with the speakers.",
    );
}
main().catch((error) => {
  console.error(
    error instanceof InputError
      ? error.message
      : "Smoke preflight failed. See --help and check file permissions.",
  );
  process.exitCode = 1;
});
