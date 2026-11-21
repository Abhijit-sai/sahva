import { meetingLanguageNames, type MeetingLanguage } from "./meeting-languages.ts";
export const roomLanguages = ["en-IN", "te-IN", "hi-IN"] as const;
export type Language = MeetingLanguage;
export const languages = {
  ...meetingLanguageNames,
  "en-IN": "English",
  "te-IN": "తెలుగు · Telugu",
  "hi-IN": "हिन्दी · Hindi",
};
export const consentVersion = "2026-11-21-v1";
export const disclosure =
  "Sahva stores voice turns and sends audio and text to AI providers for transcription, translation, synthetic speech and meeting summaries. Both participants can replay recordings and read transcripts. AI can make mistakes. Room access lasts 24 hours. Deletion is handled by the demo operator.";
export const meetingConsent = "2026-11-21-group-v1";
export const meetingDisclosure =
  "Participants can read the meeting history and replay original recordings. Each participant can replay their own incoming interpretation. LiveKit transports your microphone audio. Gemini Live Translate processes microphone audio. Sahva saves original recordings and the audio from your interpretation stream for replay. Meeting notes use the session transcript. Room access lasts 24 hours. The demo operator handles deletion.";
export const otherLanguage = (source: Language): "en-IN" | "te-IN" =>
  source === "en-IN" ? "te-IN" : "en-IN";
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
  transport: "livekit" | "phrase";
  media_epoch: number;
  status: "active" | "ended";
  created_at: string;
  ended_at: string | null;
  expires_at: string;
};
