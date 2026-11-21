import type { Language } from "./shared.ts";

// Bulbul v4 Flash persona IDs are language-specific.
export const voices = {
  "en-IN": [
    { id: "simran_en_customer", name: "Simran" },
    { id: "dev_en_conversational", name: "Dev" },
  ],
  "hi-IN": [{ id: "shubh_enhi_ads", name: "Shubh" }],
  "te-IN": [
    { id: "pooja_te_conversation", name: "Pooja" },
    { id: "kavitha_te_conversation", name: "Kavitha" },
    { id: "tarun_te_narration", name: "Tarun" },
  ],
} as const;

export function voicesFor(language: Language): readonly {id:string; name:string}[] {
  return Object.hasOwn(voices,language) ? voices[language as keyof typeof voices] : [];
}
export function defaultIncomingVoice(language: Language) {
  return language === "te-IN" ? "tarun_te_narration" : (voicesFor(language)[0]?.id ?? "");
}

export function supportsVoice(
  language: Language,
  value: unknown,
): value is string {
  return voicesFor(language).some((voice) => voice.id === value);
}
