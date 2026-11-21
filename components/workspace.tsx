"use client";
import Link from "next/link";
import { useEffect, useReducer, useState } from "react";
import { Entry } from "./entry";
import { Report } from "./report";
import { Recorder } from "./recorder";
import { TurnCard, type TurnView } from "./turn-card";
import { api } from "./client";
import {
  consentVersion,
  languages,
  type Room,
  type Member,
} from "../lib/shared";

type Snapshot = {
  room: Room;
  members: Member[];
  me: Member;
  canRecord: boolean;
  turns: TurnView[];
};
export function Workspace({ id }: { id: string }) {
  const [invite, setInvite] = useState(""),
    [share, setShare] = useState("");
  const [state, setState] = useState<Snapshot | null>(null),
    [connection, setConnection] = useState(""),
    [error, setError] = useState("");
  const [now, setNow] = useState(0),
    [tab, setTab] = useState("room");
  const [tick, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let processing = false;
    async function poll() {
      try {
        const snapshot = await api<Snapshot>("/" + id + "/timeline");
        if (!live) return;
        setState(snapshot);
        setNow(Date.now());
        setConnection("");
        const pending = snapshot.turns.find(
          (t) => t.stage !== "ready" && !t.error && !t.busy,
        );
        if (
          snapshot.members.length === 2 &&
          snapshot.members.every((m) => m.consented_at) &&
          pending &&
          (snapshot.canRecord || pending.revision > 0) &&
          !processing
        ) {
          processing = true;
          void api("/" + id + "/turns/" + pending.id + "/process", {})
            .catch(() => {
              if (live) setError("Processing paused. Reconnect to continue.");
            })
            .finally(() => {
              processing = false;
            });
        }
      } catch (e) {
        if (live) setConnection((e as Error).message);
      }
      if (!live) return;
      setInvite(
        new URLSearchParams(location.hash.slice(1)).get("invite") ?? "",
      );
      const own = sessionStorage.getItem("invite-" + id);
      if (own) setShare(location.origin + "/room/" + id + "#invite=" + own);
      timer = setTimeout(poll, document.hidden ? 5000 : 1500);
    }
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id, tick]);
  if (!state && invite) return <Entry id={id} invite={invite} />;
  if (!state)
    return (
      <main>
        <h1>Conversation room</h1>
        <p role="status">{connection || "Opening room…"}</p>
        <Link href="/">Create a room</Link>
      </main>
    );
  const active = state.room.status === "active";
  return (
    <main>
      <p className="eyebrow">
        Turn-based audio room · {active ? "Active" : "Ended"} ·{" "}
        {Math.max(
          0,
          Math.floor(
            ((state.room.ended_at ? Date.parse(state.room.ended_at) : now) -
              Date.parse(state.room.created_at)) /
              60000,
          ),
        )}{" "}
        min
      </p>
      <h1>{state.room.title}</h1>
      <nav className="tabs" aria-label="Room panels">
        {["room", "conversation"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "room" ? "Room" : "Conversation"}
          </button>
        ))}
      </nav>
      <div className="split" data-tab={tab}>
        <section className="room-panel">
          <h2>Room</h2>
          {state.members.map((m) => (
            <div className="member" key={m.id}>
              <strong>
                {m.name}
                {m.id === state.me.id ? " (you)" : ""}
              </strong>
              <small>
                {languages[m.listening]} ·{" "}
                {m.consented_at ? "Consented" : "Consent withdrawn"} ·{" "}
                {m.recording
                  ? "Recording"
                  : now - Date.parse(m.last_seen) < 20000
                    ? "Present"
                    : "Away"}
              </small>
            </div>
          ))}
          {share && state.members.length === 1 && active && (
            <label>
              Invite a participant
              <input
                aria-label="Invitation link"
                value={share}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
          {state.canRecord && !connection ? (
            <Recorder room={id} onUploaded={refresh} />
          ) : (
            <p>
              {connection
                ? "Recording paused while reconnecting."
                : active
                  ? "Recording requires two consenting participants."
                  : "This room has ended."}
            </p>
          )}
          {active && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await api("/" + id + "/consent", {
                    accepted: !state.me.consented_at,
                    consentVersion,
                  });
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {state.me.consented_at ? "Withdraw consent" : "Consent again"}
            </button>
          )}
          {active && state.me.seat === 1 && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await api("/" + id + "/end", {});
                  setTab("conversation");
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              End room
            </button>
          )}
        </section>
        <section className="conversation-panel">
          {!active && (
            <Report
              key={state.turns.map((t) => t.id + "-" + t.revision).join(",")}
              room={id}
              preferred={state.me.listening}
              onEvidence={(turn) =>
                document
                  .getElementById("turn-" + turn)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            />
          )}
          <h2>Conversation timeline</h2>
          {!state.turns.length && <p>No turns yet.</p>}
          {state.turns.map((t) => (
            <TurnCard
              key={t.id}
              room={id}
              turn={t}
              name={
                state.members.find((m) => m.id === t.speaker_id)?.name ??
                "Participant"
              }
              own={state.me.id === t.speaker_id}
              active={
                state.members.every((m) => m.consented_at) &&
                (active || t.revision > 0 || !!t.raw_text)
              }
              onUpdate={refresh}
            />
          ))}
        </section>
      </div>
      {(connection || error) && <p role="alert">{connection || error}</p>}
    </main>
  );
}
