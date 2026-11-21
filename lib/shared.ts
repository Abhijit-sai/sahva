export type Language = "en-IN" | "te-IN";
export const languages = { "en-IN": "English", "te-IN": "తెలుగు · Telugu" };
export const consentVersion = "2026-11-21-v1";
export const disclosure =
  "Sahva stores voice turns and sends audio and text to AI providers for transcription, translation, synthetic speech and meeting summaries. Both participants can replay recordings and read transcripts. AI can make mistakes. Room access lasts 24 hours. Deletion is handled by the demo operator.";
export type Member = {
  id: string;
  name: string;
  listening: Language;
  speaking: Language;
  seat: number;
  consented_at: string | null;
  last_seen: string;
  recording: boolean;
};
export type Room = {
  id: string;
  title: string;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
  expires_at: string;
};
