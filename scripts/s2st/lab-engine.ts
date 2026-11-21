import { eligible, setupIssue, type Engine, type Lang } from "./catalog.ts";
import { gemini, type Hooks } from "./engines.ts";
import { realtime } from "./realtime-translate.ts";
import { baseline } from "./baseline.ts";

export async function startEngine(
  engine: Engine,
  source: Lang,
  target: Lang,
  hooks: Hooks,
) {
  if (!eligible(engine, source, target))
    throw Error("This spoken direction is unsupported");
  const issue = setupIssue(engine);
  if (issue) throw Error(issue);
  if (engine === "sarvam") {
    const segments = {
      source: new Map<string, string>(),
      target: new Map<string, string>(),
    };
    return baseline(source === "en" ? "en-IN" : "te-IN", {
      ...hooks,
      text(side, text, final, language, segment) {
        segments[side].set(segment!, text);
        hooks.text(
          side,
          [...segments[side].values()].join(" "),
          final,
          language,
        );
      },
    });
  }
  if (engine === "gemini")
    return gemini(source, target, hooks, {
      hintSourceLanguage: true,
      echoTargetLanguage: true,
      reportingPeriods: source === "en" && target === "te",
    });
  return realtime(engine, source, target, hooks);
}
