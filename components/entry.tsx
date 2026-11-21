"use client";
import { useState } from "react";
import { api } from "./client";
import { consentVersion, disclosure, languages } from "../lib/shared";
export function Entry({ id, invite }: { id?: string; invite?: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="entry">
      <div className="intro">
        <p className="eyebrow">Turn-based audio room</p>
        <h1>
          {id
            ? "Join the conversation."
            : "Speak naturally. Understand everyone."}
        </h1>
        <p>
          {id
            ? "Choose how you want to speak and listen."
            : "Exchange voice turns in Telugu and English, then review what you agreed together."}
        </p>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const fields = Object.fromEntries(new FormData(event.currentTarget));
          try {
            const room = await api<{ roomId: string; invite?: string }>(
              id ? "/" + id + "/join" : "",
              {
                ...fields,
                invite,
                acceptedConsent: fields.consent === "on",
                consentVersion,
              },
            );
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
                <select name={name}>
                  {Object.entries(languages).map(([code, label]) => (
                    <option value={code} key={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ),
          )}
        </div>
        <p className="notice">{disclosure}</p>
        <label className="check">
          <input type="checkbox" name="consent" required />I consent to
          recording and AI processing.
        </label>
        <button disabled={busy}>
          {busy ? "Connecting…" : id ? "Agree & join" : "Agree & create room"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
