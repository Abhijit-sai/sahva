import { mkdir, writeFile } from "node:fs/promises";
if (process.argv[2] !== "--synthetic")
  throw Error("Pass --synthetic to create the Hindi test recording");
const script =
  "अनुषा, विजयवाड़ा में पंद्रह डिब्बे मत भेजना। केवल बारह डिब्बे भेजना।";
const res = await fetch("https://api.sarvam.ai/text-to-speech", {
  method: "POST",
  headers: {
    "api-subscription-key": process.env.SARVAM_API_KEY ?? "",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    text: script,
    language_code: "hi-IN",
    model: "bulbul:v4-flash",
    output_audio_codec: "wav",
  }),
  signal: AbortSignal.timeout(20000),
});
if (!res.ok) throw Error("Hindi fixture synthesis HTTP " + res.status);
const bytes = Buffer.from((await res.json()).audios[0], "base64");
if (bytes.toString("ascii", 0, 4) !== "RIFF")
  throw Error("Invalid fixture audio");
await mkdir(".sahva/lab-hindi", { recursive: true });
await writeFile(".sahva/lab-hindi/corrections.wav", bytes, { flag: "wx" });
await writeFile(
  ".sahva/lab-hindi/corrections.json",
  JSON.stringify({ script, synthetic: true, model: "bulbul:v4-flash" }),
);
