"use client";
import { useState } from "react";
import { api } from "./client";
import { languages, type Language } from "../lib/shared";
import type { TurnTiming } from "../lib/rehearsal";
export type TurnView = {
  live_timing?: TurnTiming | null;
  translated_at?: number | null;
  generated_at?: number | null;
  transcribed_at?: number | null;
  id: string;
  seq: number;
  speaker_id: string;
  duration_ms: number;
  created_at: string;
  source: Language | null;
  raw_text: string | null;
  target: Language;
  revision: number;
  stage: "stt" | "translation" | "tts" | "ready";
  error: string | null;
  retries: number;
  current_text: string | null;
  translated_text: string | null;
  voice: boolean;
  busy: boolean;
};
const stages = {
  stt: "Transcribing",
  translation: "Translating",
  tts: "Generating voice",
  ready: "Ready",
};
export function TurnCard({
  room,
  turn,
  name,
  own,
  active,
  onUpdate,
  playing,
}: {
  room: string;
  turn: TurnView;
  name: string;
  own: boolean;
  active: boolean;
  onUpdate: () => void;
  playing: boolean;
}) {
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const root = "/" + room + "/turns/" + turn.id;
  const media = "/api/v1/rooms/" + room + "/media/" + turn.id + "?kind=";
  return (
    <article
      id={"turn-" + turn.id}
      className={"chat-message " + (own ? "own" : "incoming")}
    >
      {playing && (
        <small className="playing-label">
          Playing in {languages[turn.target]}
        </small>
      )}
      <div className="turn-top">
        <strong>{own ? "You" : name}</strong>
        <small>
          {new Date(turn.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {(turn.duration_ms / 1000).toFixed(1)}s
        </small>
      </div>
      {turn.stage !== "ready" && (
        <p className="status" role="status">
          {turn.error ? "Needs attention · " : ""}
          {stages[turn.stage]}…
        </p>
      )}
      <div className="voice-message">
        {(own || turn.voice || turn.source === turn.target) && (
          <audio
            controls
            preload="none"
            aria-label={
              own
                ? "Replay your message"
                : turn.voice
                  ? "Replay translated message"
                  : "Replay message"
            }
            src={
              media +
              (own || !turn.voice
                ? "original"
                : "translation&v=" + turn.revision)
            }
          />
        )}
        {(own ? turn.current_text : turn.translated_text) && (
          <p
            className="message-caption"
            lang={(own ? turn.source : turn.target) ?? undefined}
          >
            {own ? turn.current_text : turn.translated_text}
          </p>
        )}
      </div>
      <details className="message-original">
        <summary>Original</summary>
        <small>
          {turn.source ? languages[turn.source] : "Source recording"}
        </small>
        <audio
          aria-label="Original recording"
          controls
          preload="none"
          src={media + "original"}
        />
        <p lang={turn.source ?? undefined}>
          {turn.raw_text ?? "Transcript unavailable."}
        </p>
        {turn.revision > 0 && <p>Speaker correction · {turn.current_text}</p>}
      </details>
      {own && turn.voice && (
        <details>
          <summary>Sent translation · {languages[turn.target]}</summary>
          <audio
            controls
            preload="none"
            aria-label="Sent translated voice"
            src={media + "translation&v=" + turn.revision}
          />
          <p lang={turn.target}>{turn.translated_text}</p>
        </details>
      )}
      {turn.error && (
        <p>
          {turn.error === "PROVIDER_NOT_CONFIGURED"
            ? "Speech provider is not configured."
            : turn.error === "NO_SPEECH"
              ? "No speech detected."
              : "Processing failed (" + turn.error + ")."}{" "}
          The original is saved.
        </p>
      )}
      {turn.error && active && turn.retries < 1 && (
        <button
          className="secondary"
          disabled={working}
          onClick={async () => {
            setWorking(true);
            try {
              await api(root + "/retry", {});
              onUpdate();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setWorking(false);
            }
          }}
        >
          Retry {stages[turn.stage].toLowerCase()}
        </button>
      )}
      {own && active && turn.raw_text && !editing && (
        <button className="secondary" onClick={() => setEditing(true)}>
          Correct transcript
        </button>
      )}
      {editing && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setWorking(true);
            const correctedText = new FormData(e.currentTarget).get("text");
            try {
              await api(root + "/revisions", {
                correctedText,
                expectedCurrentRevision: turn.revision,
              });
              setEditing(false);
              onUpdate();
            } catch (ex) {
              setError((ex as Error).message);
            } finally {
              setWorking(false);
            }
          }}
        >
          <label>
            Corrected transcript
            <textarea
              name="text"
              defaultValue={turn.current_text ?? ""}
              required
              maxLength={1000}
            />
          </label>
          <button disabled={working}>Save correction</button>
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
