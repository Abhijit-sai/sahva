// Public QA scripts only. This transport test does not measure human microphone quality.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { SarvamSpeech, SpeechError } from "../lib/providers/sarvam.ts";

async function main() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("Missing SARVAM_API_KEY");
  const speech = new SarvamSpeech(key);
  await mkdir(".sahva", { recursive: true });
  const dir = await mkdtemp(join(".sahva", "synthetic-inputs-"));
  const cases = [
    [
      "te-IN",
      "తెలుగు",
      "రమేష్ సోమవారం ఇరవై కార్టన్లు పంపిస్తాడు. సరుకు ఎప్పుడు తీసుకువెళ్తారో దయచేసి చెప్పండి.",
      "telugu.wav",
    ],
    [
      "en-IN",
      "English",
      "Okay, but please confirm the pickup time before we finalize. We might be able to send the revised plan on Friday.",
      "english.wav",
    ],
  ] as const;
  for (const [language, , text, name] of cases) {
    const clip = await speech.synthesize(text, language);
    await writeFile(join(dir, name), clip.audio);
    console.log(
      JSON.stringify({
        fixture: "synthetic",
        language,
        requestId: clip.requestId,
        ms: clip.elapsedMs,
      }),
    );
  }
  console.log("Starting real API smoke on synthetic speech only.");
  const result = spawnSync(
    process.execPath,
    [
      "--disable-warning=ExperimentalWarning",
      "--experimental-strip-types",
      "scripts/speech-smoke.ts",
      "--telugu",
      join(dir, "telugu.wav"),
      "--english",
      join(dir, "english.wav"),
      "--consented",
    ],
    { stdio: "inherit", windowsHide: true },
  );
  process.exitCode = result.status ?? 1;
}
main().catch((error) => {
  console.error(
    error instanceof SpeechError
      ? error.message
      : "Synthetic fixture setup failed",
  );
  process.exitCode = 1;
});
