export const languages = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  es: "Spanish",
} as const;
export type Lang = keyof typeof languages;
export const candidates = {
  sarvam: {
    name: "Sahva Standard · Sarvam",
    model: "saaras:v4 / mayura:v1 / bulbul:v4-flash",
    sources: ["te", "en"],
    targets: ["te", "en"],
    mode: "pipeline",
    voice: "Language-specific Bulbul preset",
    keys: ["SARVAM_API_KEY"],
  },
  gemini: {
    name: "Gemini Live Translate",
    model: "gemini-3.5-live-translate-preview",
    sources: ["te", "en", "hi", "es"],
    targets: ["te", "en", "hi", "es"],
    mode: "direct",
    voice: "Provider interpretation voice",
    keys: ["GEMINI_API_KEY"],
  },
  openai: {
    name: "OpenAI Realtime Translate",
    model: "gpt-realtime-translate",
    sources: ["te", "en", "hi", "es"],
    targets: ["en", "hi", "es"],
    mode: "direct",
    voice: "Provider interpretation voice",
    keys: ["OPENAI_API_KEY"],
  },
  qwen: {
    name: "Qwen LiveTranslate",
    model: "qwen3.8-livetranslate-flash-realtime",
    sources: ["en", "hi", "es"],
    targets: ["en", "hi", "es"],
    mode: "direct",
    voice: "Tina · preset",
    keys: ["DASHSCOPE_API_KEY", "DASHSCOPE_WORKSPACE_ID", "DASHSCOPE_REGION"],
  },
} satisfies Record<
  string,
  {
    name: string;
    model: string;
    sources: Lang[];
    targets: Lang[];
    mode: string;
    voice: string;
    keys: string[];
  }
>;
export type Engine = keyof typeof candidates;
export function eligible(engine: Engine, source: string, target: string) {
  const c = candidates[engine];
  return (
    source !== target &&
    (c.sources as string[]).includes(source) &&
    (c.targets as string[]).includes(target)
  );
}
export function setupIssue(engine: Engine) {
  const missing = candidates[engine].keys.filter(
    (k) => !process.env[k]?.trim(),
  );
  if (missing.length)
    return "Configure " + missing.join(", ") + " in .env.local.";
  if (
    engine === "qwen" &&
    (!/^[a-z0-9-]{1,80}$/i.test(process.env.DASHSCOPE_WORKSPACE_ID!) ||
      !["ap-southeast-1", "cn-beijing"].includes(process.env.DASHSCOPE_REGION!))
  )
    return "Check the Alibaba workspace ID and region.";
  return "";
}
