"use client";
import { useState } from "react";
import { api } from "./client";
import { languages, type Language } from "../lib/shared";
export type TurnView = {
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
}: {
  room: string;
  turn: TurnView;
  name: string;
  own: boolean;
  active: boolean;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  const root = "/" + room + "/turns/" + turn.id;
  const media = "/api/v1/rooms/" + room + "/media/" + turn.id + "?kind=";
  return (
    <article id={"turn-" + turn.id}>
      <div className="turn-top">
        <strong>{name}</strong>
        <small>
          Turn {turn.seq} ·{" "}
          {new Date(turn.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {(turn.duration_ms / 1000).toFixed(1)}s
        </small>
      </div>
      <p className="status">
        {turn.error
          ? "Needs attention · " + stages[turn.stage]
          : stages[turn.stage]}
      </p>
      <label>
        Original recording {turn.source && "· " + languages[turn.source]}
        <audio controls preload="none" src={media + "original"} />
      </label>
      {turn.voice && (
        <label>
          Synthetic voice · {languages[turn.target]}
          <audio
            controls
            preload="none"
            src={media + "translation&v=" + turn.revision}
          />
        </label>
      )}
      {turn.source === turn.target && turn.stage === "ready" && (
        <small>The original is in the listener’s language.</small>
      )}
      {turn.raw_text && (
        <details>
          <summary>Original transcript</summary>
          <p>{turn.current_text}</p>
          {turn.revision > 0 && (
            <>
              <small>Speaker correction · revision {turn.revision}</small>
              <p>Original ASR · {turn.raw_text}</p>
            </>
          )}
        </details>
      )}
      {turn.translated_text && turn.source !== turn.target && (
        <details>
          <summary>Translated transcript · {languages[turn.target]}</summary>
          <p>{turn.translated_text}</p>
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
