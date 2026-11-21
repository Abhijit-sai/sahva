import { createHash, randomInt } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { SarvamSpeech } from "../../lib/providers/sarvam.ts";
import { loadRecording, now, voicedBounds, wav } from "./audio.ts";
import { connect, model } from "./engines.ts";

if (process.argv[2] !== "--synthetic")
  throw Error("Pass --synthetic to run the quarter A/B");
const speech = new SarvamSpeech(process.env.SARVAM_API_KEY ?? "");
await mkdir(".sahva", { recursive: true });
const dir = await mkdtemp(".sahva/quarter-ab-");
console.log("Private trial directory", dir);
const reveal: Record<string, boolean> = {};
const tail =
  "One million was our target this month. Last month we saw an increase of just ten percent. But we did not even reach the bare minimum.";
const samples = [];
const usePronoun = process.argv[3] === "--pronoun";
for (const [id, comparison] of [
  [
    "previous",
    usePronoun
      ? "The results of my last quarter were far better than this one."
      : "My results last quarter were far better than this quarter.",
  ],
  [
    "current",
    usePronoun
      ? "The results of my current quarter were far better than the last one."
      : "My results this quarter were far better than last quarter.",
  ],
]) {
  const script = comparison + " " + tail;
  const path = join(dir, id + ".wav");
  await writeFile(path, (await speech.synthesize(script, "en-IN")).audio);
  const pcm = await loadRecording(path);
  samples.push({ id, pcm });
  await writeFile(
    join(dir, id + ".json"),
    JSON.stringify(
      {
        script,
        model,
        pcmSha256: createHash("sha256").update(pcm).digest("hex"),
      },
      null,
      2,
    ),
  );
}

async function render(pcm: Buffer, reportingPeriods: boolean, label: string) {
  const audio: Buffer[] = [];
  const source: string[] = [],
    target: string[] = [];
  let lastActivity = 0;
  const session = await connect(
    "gemini",
    "en-IN",
    {
      text(side, text) {
        if (text) {
          (side === "source" ? source : target).push(text);
          lastActivity = now();
        }
      },
      audio(chunk) {
        audio.push(chunk);
        if (voicedBounds(chunk, 24000).first !== null) lastActivity = now();
      },
      event() {},
      usage() {},
    },
    { hintSourceLanguage: true, echoTargetLanguage: true, reportingPeriods },
  );
  try {
    const start = now();
    for (let i = 0; i < pcm.length; i += 3200) {
      await wait(Math.max(0, start + i / 32 - now()));
      await session.feed(pcm.subarray(i, i + 3200));
    }
    await wait(Math.max(0, start + pcm.length / 32 - now()));
    await session.finish();
    const end = now();
    while (now() - Math.max(end, lastActivity) < 4500) {
      session.check();
      if (now() - end > 20000) throw Error("Output drain timed out");
      await wait(100);
    }
  } finally {
    session.close();
  }
  const bytes = Buffer.concat(audio);
  const bounds = voicedBounds(bytes, 24000);
  if (!target.length || bounds.last === null)
    throw Error("Missing Telugu output");
  const translated = wav(
    bytes.subarray(0, Math.min(bytes.length, (bounds.last + 400) * 48)),
    24000,
  );
  await writeFile(join(dir, label + ".wav"), translated);
  // A second recognizer checks the actual speech; its wording can differ from Gemini's caption.
  const heard = await speech.transcribe(
    new File([new Uint8Array(translated)], "translation.wav", {
      type: "audio/wav",
    }),
  );
  await writeFile(
    join(dir, label + ".json"),
    JSON.stringify(
      {
        source: source.join(""),
        target: target.join(""),
        independentASR: heard.text,
        asrLanguage: heard.language,
        pcmSha256: createHash("sha256").update(pcm).digest("hex"),
      },
      null,
      2,
    ),
  );
}
for (let round = 1; round <= (usePronoun ? 1 : 3); round++) {
  for (const { id, pcm } of samples) {
    const xIsNew = randomInt(2) === 1;
    const pair = ["x", "y"].map((side, i) => {
      const label = [id, round, side].join("-");
      const tuned = i === 0 ? xIsNew : !xIsNew;
      reveal[label] = tuned;
      return { label, tuned };
    });
    await writeFile(join(dir, "key.json"), JSON.stringify(reveal, null, 2));
    const outcome = await Promise.allSettled(
      pair.map((p) => render(pcm, p.tuned, p.label)),
    );
    if (outcome.some((r) => r.status === "rejected"))
      throw Error(
        "Incomplete pair " +
          id +
          " " +
          round +
          ": " +
          outcome
            .filter((r) => r.status === "rejected")
            .map((r) => r.reason?.message)
            .join(", "),
      );
    console.log("Completed blind pair", id, round);
  }
}
