import { loadRecording, voicedBounds, wav, now } from "./audio.ts";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { candidates, languages, type Lang, type Engine } from "./catalog.ts";
import { startEngine } from "./lab-engine.ts";

const [engine, source, target, file, consent] = process.argv.slice(2) as [
  Engine,
  Lang,
  Lang,
  string,
  string,
];
if (
  !Object.hasOwn(candidates, engine) ||
  !Object.hasOwn(languages, source) ||
  !Object.hasOwn(languages, target) ||
  consent !== "--consented"
)
  throw Error("Pass engine, source, target, WAV and --consented");
const pcm = await loadRecording(file);
const bounds = voicedBounds(pcm, 16000);
if (bounds.first === null || bounds.last === null) throw Error("Silent input");
await mkdir(".sahva", { recursive: true });
const dir = await mkdtemp(".sahva/model-lab-");
console.log("Private trial", dir, engine, source, target);
const outputs: Buffer[] = [],
  captions = { source: "", target: "" };
let start = 0,
  firstText: number | null = null,
  firstAudio: number | null = null,
  lastActivity = 0;
const receipt = {
  engine,
  model: candidates[engine].model,
  source,
  target,
  sha256: createHash("sha256").update(pcm).digest("hex"),
  bytes: pcm.length,
  voice: candidates[engine].voice,
};
const session = await startEngine(engine, source, target, {
  audio(b, format) {
    outputs.push(b);
    if (format === "wav" || voicedBounds(b, 24000).first !== null) {
      firstAudio ??= now();
      lastActivity = now();
    }
  },
  text(side, t) {
    if (t) {
      captions[side] = engine === "sarvam" ? t : captions[side] + t;
      lastActivity = now();
      if (side === "target") firstText ??= now();
    }
  },
  event() {},
  usage() {},
});
try {
  start = now();
  for (let i = 0; i < pcm.length; i += 3200) {
    await wait(Math.max(0, start + i / 32 - now()));
    session.check();
    await session.feed(pcm.subarray(i, i + 3200));
  }
  await wait(Math.max(0, start + pcm.length / 32 - now()));
  await session.finish();
  const end = now();
  while (
    engine === "gemini" &&
    now() - end < 15000 &&
    (firstAudio === null || now() - Math.max(end, lastActivity) < 4500)
  ) {
    session.check();
    await wait(100);
  }
  if (firstAudio === null) throw Error("No voiced translation");
  const audio = Buffer.concat(outputs);
  if (engine === "sarvam")
    for (const [i, b] of outputs.entries())
      await writeFile(join(dir, "part-" + i + ".wav"), b);
  else await writeFile(join(dir, "translated.wav"), wav(audio, 24000));
  const measures = {
    firstTextMs:
      firstText === null ? null : Math.round(firstText - start - bounds.first),
    firstVoicedReceiptMs: Math.round(firstAudio - start - bounds.first),
    sourceSpeechMs: Math.round(bounds.last - bounds.first),
    endToFirstVoicedReceiptMs: Math.round(firstAudio - start - bounds.last),
  };
  await writeFile(
    join(dir, "result.json"),
    JSON.stringify({ ...receipt, captions, measures }, null, 2),
  );
  console.log(JSON.stringify(measures));
} finally {
  session.close();
}
