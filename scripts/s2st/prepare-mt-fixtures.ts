/** Import recording-sheet originals read-only into the private benchmark workspace. */
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { loadRecording, wav } from "./audio.ts";
import { recordingSheet } from "./recording-sheet.ts";

const folder = process.argv[2];
if (!folder)
  throw Error(
    "Supply the private folder containing TE-01.m4a, EN-01.wav, etc.",
  );
const prompts = await recordingSheet();
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const fixtures = [];
await mkdir(".sahva", { recursive: true });
const out = await mkdtemp(".sahva/mt-fixtures-");
for (const filename of (await readdir(folder)).sort()) {
  const match = /^(TE|EN)-(\d\d)\.(wav|m4a)$/i.exec(filename);
  if (!match) continue;
  const prompt = prompts.get(match[2]);
  if (!prompt) throw Error("Unknown recording ID " + match[2]);
  const telugu = match[1].toUpperCase() === "TE";
  const inputPath = join(folder, filename);
  const original = await stat(inputPath);
  if (original.size > 4_000_000)
    throw Error("Original exceeds 4 MB: " + filename);
  const originalSha256 = hash(await readFile(inputPath));
  const pcm = await loadRecording(
    inputPath,
    match[3].toLowerCase() === "m4a" ? "mov" : "wav",
  );
  const after = await stat(inputPath);
  if (original.size !== after.size || original.mtimeMs !== after.mtimeMs)
    throw Error("Original changed during import: " + filename);
  const file = match[2] + "/" + (telugu ? "telugu.wav" : "english.wav");
  await mkdir(join(out, match[2]), { recursive: true });
  await writeFile(join(out, file), wav(pcm, 16000), { flag: "wx" });
  fixtures.push({
    id: match[1].toUpperCase() + "-" + match[2],
    wav: file,
    originalFile: filename,
    originalSha256,
    pcmSha256: hash(pcm),
    samples: pcm.length / 2,
    source: telugu ? "te-IN" : "en-IN",
    target: telugu ? "en-IN" : "te-IN",
    sourceText: telugu ? prompt.te : prompt.en,
    targetText: telugu ? prompt.en : prompt.te,
    criticalFacts: [prompt.critical],
    referenceRevision: "",
    confirmedBy: "",
    consentRecord: "",
    allowedProcessors: [],
  });
}
if (!fixtures.length) throw Error("No recording-sheet WAV or M4A files found");
await writeFile(
  join(out, "manifest.draft.json"),
  JSON.stringify(fixtures, null, 2),
  { flag: "wx" },
);
console.log(
  out,
  fixtures.length,
  "clips. Confirm actual wording and processor consent before the MT-only comparison.",
);
