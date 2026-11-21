import type { Language } from "../../lib/providers/sarvam.ts";
import type { Lang } from "./catalog.ts";
import { baseline } from "./baseline.ts";
import { gemini, type Hooks } from "../../lib/providers/gemini-interpretation.ts";
export { gemini, model, type Hooks } from "../../lib/providers/gemini-interpretation.ts";
type Engine = "gemini" | "sarvam";
export async function connect(
  engine: Engine,
  source: Language,
  hooks: Hooks,
  options: {
    hintSourceLanguage?: boolean;
    echoTargetLanguage?: boolean;
    reportingPeriods?: boolean;
  } = {},
) {
  const target = source === "te-IN" ? "en-IN" : "te-IN";
  if (engine === "sarvam") return baseline(source, hooks);
  return gemini(
    source.slice(0, 2) as Lang,
    target.slice(0, 2) as Lang,
    hooks,
    options,
  );
}
