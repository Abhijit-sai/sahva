import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SarvamSpeech } from "../../lib/providers/sarvam.ts";
import { loadRecording, wav } from "./audio.ts";

// Fictional scripts. Preserve the exact synthesized bytes for both engines and subsequent reviews.
const scripts = [
  {
    name: "corrections",
    te: [
      "అనూష గారూ, విజయవాడకు పదిహేను బాక్సులు పంపకండి. పన్నెండు బాక్సులు మాత్రమే పంపండి.",
    ],
    en: [
      "Anusha, do not send fifteen boxes to Vijayawada. Send only twelve boxes.",
    ],
  },
  {
    name: "business",
    te: [
      "హైదరాబాద్ టీమ్ కోసం బడ్జెట్ ఇరవై ఐదు వేల రూపాయలు. జూన్ పదిహేనున సర్వర్ అప్డేట్ పూర్తి అవుతుందా?",
    ],
    en: [
      "Our Hyderabad team has a budget of twenty-five thousand rupees. Will the server update finish on June fifteenth?",
    ],
  },
  {
    name: "switch",
    te: [
      "శ్రావణి, please hold the release. QA sign-off వచ్చిన తర్వాత మాత్రమే deploy చేయండి.",
    ],
    en: [
      "Kiran, the Vizag shipment is on hold. రేపు ఉదయం please call the supplier again.",
    ],
  },
  {
    name: "pause",
    te: [
      "దయచేసి కాసేపు ఆగండి.",
      "చాలా అర్జెంట్! బ్యాకప్ పూర్తయ్యే వరకు డేటాబేస్ రీస్టార్ట్ చేయకండి.",
    ],
    en: [
      "Please wait a moment.",
      "This is urgent! Do not restart the database until the backup finishes.",
    ],
  },
] as const;
if (process.argv[2] !== "--synthetic")
  throw Error("Pass --synthetic and optionally a scenario name");
const requested = scripts.filter(
  (s) => !process.argv[3] || s.name === process.argv[3],
);
if (!requested.length) throw Error("Unknown scenario");
const speech = new SarvamSpeech(process.env.SARVAM_API_KEY ?? "");
await mkdir(".sahva", { recursive: true });
const root = await mkdtemp(".sahva/s2st-fixtures-");
console.log("Private synthetic fixture directory:", root);
for (const scenario of requested) {
  const dir = join(root, scenario.name);
  await mkdir(dir);
  await writeFile(
    join(dir, "reference.json"),
    JSON.stringify(scenario, null, 2),
  );
  for (const lang of ["te", "en"] as const) {
    const pieces: Buffer[] = [];
    for (const [idx, text] of scenario[lang].entries()) {
      const part = join(dir, lang + "-" + idx + ".wav");
      await writeFile(
        part,
        (await speech.synthesize(text, lang === "te" ? "te-IN" : "en-IN"))
          .audio,
      );
      if (idx) pieces.push(Buffer.alloc(32000)); // One second of deliberate silence.
      pieces.push(await loadRecording(part));
    }
    await writeFile(
      join(dir, lang === "te" ? "telugu.wav" : "english.wav"),
      wav(Buffer.concat(pieces), 16000),
    );
  }
}
