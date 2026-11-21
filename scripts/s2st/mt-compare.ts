/** Isolated MT evaluation. Run from the repo root. Human review lives in a separate private file. */
import { createHash, randomInt, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { SarvamSpeech, SpeechError } from "../../lib/providers/sarvam.ts";
import { loadRecording } from "./audio.ts";
import { recordingSheet } from "./recording-sheet.ts";

const language = z.enum(["en-IN", "te-IN"]);
const reference = z.string().trim().min(1).max(4000);
const digest = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
const schema = z
  .array(
    z.object({
      id: z.string().regex(/^[\w-]{1,64}$/),
      wav: z.string().min(1),
      pcmSha256: z.string().regex(/^[0-9a-f]{64}$/),
      source: language,
      target: language,
      sourceText: reference,
      targetText: reference,
      referenceRevision: reference,
      confirmedBy: reference,
      consentRecord: reference,
      allowedProcessors: z.array(z.enum(["sarvam", "indictrans2"])),
      criticalFacts: z.array(reference).min(1),
    }),
  )
  .min(1)
  .max(200);
const [manifest, mode = "validate", rawRepeats = "1"] = process.argv.slice(2);
const repeats = Number(rawRepeats);
if (
  !manifest ||
  !["validate", "sarvam", "paired"].includes(mode) ||
  !Number.isInteger(repeats) ||
  repeats < 1 ||
  repeats > 10
)
  throw Error(
    "Pass private manifest.json, validate|sarvam|paired, and 1–10 repeats.",
  );
async function fictionalSamples() {
  const sheet = await recordingSheet();
  return ["01", "02", "03", "04", "05"].flatMap((id) => {
    const prompt = sheet.get(id);
    if (!prompt) throw Error("Missing fictional prompt " + id);
    const referenceRevision = digest(JSON.stringify(prompt));
    return (["en-IN", "te-IN"] as const).map((source) => ({
      id: "script-" + source + "-" + id,
      source,
      target: source === "en-IN" ? "te-IN" as const : "en-IN" as const,
      sourceText: source === "en-IN" ? prompt.en : prompt.te,
      targetText: source === "en-IN" ? prompt.te : prompt.en,
      referenceRevision,
      criticalFacts: [prompt.critical],
      pcmSha256: null,
    }));
  });
}
const fictional = manifest === "--fictional";
const entries = fictional ? await fictionalSamples() : schema.parse(JSON.parse(await readFile(manifest, "utf8")));
const ids = new Set<string>();
for (const f of entries) {
  if (ids.has(f.id) || f.source === f.target || [...f.sourceText].length > 1000)
    throw Error("Invalid fixture identity, direction or source length");
  ids.add(f.id);
  if (!("wav" in f)) continue;
  if (
    mode !== "validate" &&
    (!f.allowedProcessors.includes("sarvam") ||
      (mode === "paired" && !f.allowedProcessors.includes("indictrans2")))
  )
    throw Error("Processor consent missing for " + f.id);
  if (
    digest(await loadRecording(resolve(dirname(manifest), f.wav))) !==
    f.pcmSha256
  )
    throw Error("Source PCM hash mismatch for " + f.id);
}
const sourceKind = fictional ? "fictional-script" : "speaker-confirmed";
console.log("Validated", entries.length, sourceKind, "fixture records.");
if (mode === "validate") process.exit(0);
const sarvam = new SarvamSpeech(process.env.SARVAM_API_KEY ?? "");
const base =
  mode === "paired"
    ? new URL(process.env.SAHVA_MT_URL ?? "http://127.0.0.1:8080")
    : null;
if (
  base &&
  !(
    base.protocol === "https:" ||
    (base.protocol === "http:" &&
      ["127.0.0.1", "[::1]"].includes(base.hostname))
  )
)
  throw Error("Use private HTTPS or a loopback tunnel");
const token = process.env.SAHVA_MT_TOKEN ?? "";
if (base && token.length < 32) throw Error("SAHVA_MT_TOKEN required");
async function worker(path: string, body?: object) {
  const r = await fetch(new URL(path, base!), {
    method: body ? "POST" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(18000),
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw Error("WORKER_HTTP_" + r.status);
  return r.json();
}
const direction = z.object({
  sourceLanguage: language,
  targetLanguage: language,
  model: z.string().min(1),
  revision: z.string().regex(/^[0-9a-f]{40}$/),
});
const capabilities = base
  ? z
      .object({
        ready: z.literal(true),
        stage: z.literal("mt"),
        directions: z.array(direction),
      })
      .parse(await worker("/v1/capabilities")).directions
  : [];
for (const f of entries)
  if (
    base &&
    !capabilities.some(
      (d) => d.sourceLanguage === f.source && d.targetLanguage === f.target,
    )
  )
    throw Error("Worker direction unavailable: " + f.id);
await mkdir(".sahva", { recursive: true });
const out = await mkdtemp(".sahva/mt-comparison-");
console.log("Private results", out);
const observations = new Map<string, number[]>();
for (const f of entries)
  for (let repeat = 1; repeat <= repeats; repeat++) {
    const engines = base ? ["sarvam", "indictrans2"] : ["sarvam"];
    if (base && randomInt(2)) engines.reverse();
    const blind = [];
    const prefix = join(out, f.id + "-" + repeat);
    for (const [i, engine] of engines.entries()) {
      const label = String.fromCharCode(65 + i),
        requestId = randomUUID(),
        started = performance.now();
      const meta = {
        engine,
        label,
        repeat,
        requestId,
        fixture: f.id,
        sourceKind,
        source: f.source,
        target: f.target,
        pcmSha256: f.pcmSha256,
        sourceTextSha256: digest(f.sourceText),
        referenceRevision: f.referenceRevision,
      };
      try {
        let result;
        if (engine === "sarvam") {
          const r = await sarvam.translate(f.sourceText, f.source, f.target);
          result = {
            translatedText: r.text,
            model: "mayura:v1",
            revision: null,
            providerRequestId: r.requestId,
          };
        } else {
          const r = direction
            .extend({
              requestId: z.literal(requestId),
              translatedText: reference,
              inferenceMs: z.number().nonnegative(),
              runtime: z.record(z.string(), z.unknown()),
              gpuAllocatedBytes: z.number().nonnegative(),
            })
            .parse(
              await worker("/v1/mt/translate", {
                requestId,
                sourceLanguage: f.source,
                targetLanguage: f.target,
                text: f.sourceText,
              }),
            );
          if (
            !capabilities.some(
              (d) =>
                d.model === r.model &&
                d.revision === r.revision &&
                d.sourceLanguage === f.source &&
                d.targetLanguage === f.target,
            ) ||
            r.sourceLanguage !== f.source ||
            r.targetLanguage !== f.target
          )
            throw Error("WORKER_RECEIPT_MISMATCH");
          result = r;
        }
        const elapsedMs = Math.round(performance.now() - started);
        const key = [engine, f.source, f.target].join("/");
        const samples = observations.get(key) ?? [];
        samples.push(elapsedMs);
        observations.set(key, samples);
        await writeFile(
          prefix + "-" + label + ".json",
          JSON.stringify(
            { ...meta, ...result, elapsedMs, status: "ok" },
            null,
            2,
          ),
        );
        blind.push({ label, text: result.translatedText });
      } catch (e) {
        const message =
          e instanceof SpeechError
            ? e.code
            : e instanceof Error &&
                /^WORKER_(HTTP_\d+|RECEIPT_MISMATCH)$/.test(e.message)
              ? e.message
              : "REQUEST_FAILED";
        await writeFile(
          prefix + "-" + label + ".json",
          JSON.stringify({
            ...meta,
            status: "failed",
            code: message,
            elapsedMs: Math.round(performance.now() - started),
          }),
        );
        blind.push({ label, error: message });
        process.exitCode = 1;
      }
    }
    await writeFile(
      prefix + "-review.json",
      JSON.stringify(
        {
          fixture: f.id,
          sourceKind,
          repeat,
          sourceText: f.sourceText,
          reference: f.targetText,
          criticalFacts: f.criticalFacts,
          outputs: blind,
          humanReview: null,
        },
        null,
        2,
      ),
    );
  }
const summary = [...observations].map(([direction, samples]) => {
  samples.sort((a, b) => a - b);
  const percentile = (p: number) => samples[Math.ceil(samples.length * p) - 1];
  return {
    direction,
    n: samples.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
  };
});
await writeFile(
  join(out, "successful-mt-rtt.json"),
  JSON.stringify(summary, null, 2),
);
