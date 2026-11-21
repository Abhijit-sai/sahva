"use client";
import { useState, useSyncExternalStore } from "react";
import { rememberVoice, VoicePicker } from "./voice-picker";
import { voices } from "../lib/voices";
import { api } from "./client";
import {
  consentVersion,
  disclosure,
  meetingConsent,
  meetingDisclosure,
  languages,
  roomLanguages,
  type Language,
} from "../lib/shared";
const hydrationSubscription = () => () => {};
export function Entry({
  id,
  invite,
  meeting = false,
  offerMeeting = false,
}: {
  id?: string;
  invite?: string;
  meeting?: boolean;
  offerMeeting?: boolean;
  liveVoiceAvailable?: boolean;
  radio?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    hydrationSubscription,
    () => true,
    () => false,
  );
  const [group, setGroup] = useState(meeting);
  const [listening, setListening] = useState<Language>("en-IN");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preferences, setPreferences] = useState<
    Record<keyof typeof voices, string>
  >({
    "hi-IN": voices["hi-IN"][0].id,
    "en-IN": voices["en-IN"][0].id,
    "te-IN": voices["te-IN"][0].id,
  });
  return (
    <main className="entry">
      <div className="intro">
        <p className="eyebrow">
          {group ? "Gemini Live Translate" : "Telugu ↔ English"} · Voice room
        </p>
        <h1>
          {id
            ? "Join the conversation."
            : group
              ? "Create a meeting room."
              : "Speak naturally. Understand everyone."}
        </h1>
        <p>
          {id
            ? "Choose how you want to speak and listen."
            : "See live captions, hear each other in your language and take the meeting outcomes with you."}
        </p>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const fields = Object.fromEntries(new FormData(event.currentTarget));
          try {
            const room = await api<{
              roomId: string;
              participantId: string;
              invite?: string;
            }>(id ? "/" + id + "/join" : "", {
              ...fields,
              invite,
              acceptedConsent: fields.consent === "on",
              transport: group ? "livekit" : "phrase",
              consentVersion: group ? meetingConsent : consentVersion,
            });
            if (!group)
              for (const target of roomLanguages)
                rememberVoice(
                  room.roomId,
                  room.participantId,
                  target,
                  preferences[target],
                );
            if (group && room.invite)
              sessionStorage.setItem("meeting-" + room.roomId, "1");
            if (room.invite)
              sessionStorage.setItem("invite-" + room.roomId, room.invite);
            location.replace("/room/" + room.roomId);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        <h2>{id ? "Join room" : "Create a room"}</h2>
        {offerMeeting && !id && (
          <label>
            Room type
            <select
              disabled={!hydrated}
              value={group ? "meeting" : "call"}
              onChange={(e) => {
                setGroup(e.target.value === "meeting");
                if (
                  e.target.value === "call" &&
                  !["en-IN", "te-IN"].includes(listening)
                )
                  setListening("en-IN");
              }}
            >
              <option value="call">Recorded phrase call · 2 people</option>
              <option value="meeting">
                {meeting
                  ? "Live interpreted call · 2–6 people"
                  : "Group meeting · up to 6 people"}
              </option>
            </select>
          </label>
        )}
        {!id && (
          <label>
            Room name
            <input
              name="title"
              required
              maxLength={80}
              defaultValue="Team conversation"
            />
          </label>
        )}
        <label>
          Your name
          <input
            name="name"
            autoComplete="given-name"
            required
            maxLength={60}
          />
        </label>
        <div className="pair">
          {(["speakingLanguage", "listeningLanguage"] as const).map(
            (name, i) => (
              <label key={name}>
                {i ? "Listen in" : "Speak in"}
                <select
                  name={name}
                  {...(i
                    ? {
                        value: listening,
                        onChange: (
                          event: React.ChangeEvent<HTMLSelectElement>,
                        ) => setListening(event.target.value as Language),
                      }
                    : {})}
                >
                  {Object.entries(languages)
                    .filter(
                      ([code]) => group || code === "en-IN" || code === "te-IN",
                    )
                    .map(([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
            ),
          )}
        </div>
        {group ? (
          <p>
            Gemini interprets live in your listening language. You hear the
            speaker’s original audio underneath.
          </p>
        ) : (
          <details>
            <summary>Choose my translated voice</summary>
            {roomLanguages
              .filter((target) => group || target !== "hi-IN")
              .map((target) => (
                <VoicePicker
                  key={target}
                  target={target}
                  value={preferences[target]}
                  onChange={(value) =>
                    setPreferences((prev) => ({ ...prev, [target]: value }))
                  }
                />
              ))}
          </details>
        )}
        <p className="notice">{group ? meetingDisclosure : disclosure}</p>
        <label className="check">
          <input type="checkbox" name="consent" required />I consent to
          recording and AI processing.
        </label>
        <button disabled={busy || !hydrated}>
          {busy ? "Connecting…" : id ? "Agree & join" : "Agree & create room"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
