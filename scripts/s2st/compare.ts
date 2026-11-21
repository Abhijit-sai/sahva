import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { loadRecording } from "./audio.ts";

const report = z.object({
  metrics: z.object({
    engine: z.enum(["gemini", "sarvam"]),
    source: z.enum(["te", "en"]),
    target: z.enum(["te", "en"]),
    failure: z.null(),
    sourcePcmSha256: z.string(),
    discardedBuffers: z.literal(0),
    firstInputSpeechMs: z.number(),
    firstTranscriptMs: z.number(),
    browserLastVoicedMs: z.number(),
    endOfSourceSpeechMs: z.number(),
    speechToFirstVoicedPlaybackMs: z.number(),
    endToFirstVoicedPlaybackMs: z.number(),
  }),
  events: z.array(z.object({ kind: z.string() })),
});
const folders = process.argv.slice(2);
if (!folders.length || folders.length % 2)
  throw Error("Pass paired completed run directories in Gemini Sarvam order.");
const median = (numbers: number[]) => {
  const v = [...numbers].sort((a, b) => a - b);
  return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2;
};
for (const source of ["te", "en"]) {
  const rows = [];
  const gains = [];
  for (let i = 0; i < folders.length; i += 2) {
    const pair = await Promise.all(
      folders.slice(i, i + 2).map(async (folder) => {
        const dir = join(folder, source);
        const { metrics: m, events } = report.parse(
          JSON.parse(await readFile(join(dir, "review.json"), "utf8")),
        );
        const pcm = await loadRecording(join(dir, "original.wav"));
        if (
          m.source !== source ||
          m.target === source ||
          createHash("sha256").update(pcm).digest("hex") !==
            m.sourcePcmSha256 ||
          events.some((e) =>
            ["interrupted", "localPlaybackStop", "injectedDisconnect"].includes(
              e.kind,
            ),
          )
        )
          throw Error("Incomplete or interrupted fixture");
        return {
          engine: m.engine,
          hash: m.sourcePcmSha256,
          caption: m.firstTranscriptMs - m.firstInputSpeechMs,
          first: m.speechToFirstVoicedPlaybackMs,
          after: m.endToFirstVoicedPlaybackMs,
          last: m.browserLastVoicedMs - m.endOfSourceSpeechMs,
        };
      }),
    );
    const [g, s] = pair;
    if (g.engine !== "gemini" || s.engine !== "sarvam" || g.hash !== s.hash)
      throw Error("Pair engine or recording mismatch");
    rows.push(...pair);
    gains.push(s.first - g.first);
  }
  for (const engine of ["gemini", "sarvam"]) {
    const group = rows.filter((r) => r.engine === engine);
    console.log(
      JSON.stringify({
        source,
        engine,
        n: group.length,
        medianSourceCaptionMs: median(group.map((r) => r.caption)),
        medianFirstPlaybackMs: median(group.map((r) => r.first)),
        medianPostSpeechMs: median(group.map((r) => r.after)),
        medianLastVoicedAfterSourceMs: median(group.map((r) => r.last)),
      }),
    );
  }
  console.log(
    JSON.stringify({
      source,
      n: gains.length,
      medianPairedGainMs: median(gains),
    }),
  );
}
