"use client";
import Link from "next/link";
import { useEffect, useReducer, useState } from "react";
import { LiveConversation, type Caption } from "./live-conversation";
import { MeetingCaptions, type RadioCaption } from "./meeting-captions";
import { InterpretedMeeting } from "./interpreted-meeting";
import { Entry } from "./entry";
import { Report } from "./report";
import { TurnCard, type TurnView } from "./turn-card";
import {
  Rehearsal,
  type ListenerObservations,
  type PlaybackObservation,
} from "./rehearsal";
import { alignClock, type ClockSample } from "../lib/rehearsal";
import { api } from "./client";
import {
  consentVersion,
  meetingConsent,
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
  caption: Caption | null;
  captions: Caption[];
  meetingIssues: Record<string, string>;
  serverTime: number;
  liveMedia?: boolean;
  radio?: boolean;
  replays?: {
    id: string;
    speaker_id: string;
    target: Member["listening"];
    started_at: string;
    duration_ms: number;
    caption: string | null;
  }[];
  radioCaptions?: RadioCaption[];
  connectedMicrophones?: string[];
  interpretationState?: "Translating" | "Catching up";
};
export function Workspace({
  id,
  liveVoiceAvailable,
  radio,
}: {
  id: string;
  liveVoiceAvailable: boolean;
  radio?: boolean;
}) {
  const [invite, setInvite] = useState(""),
    [share, setShare] = useState("");
  const [state, setState] = useState<Snapshot | null>(null),
    [connection, setConnection] = useState(""),
    [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [clock, setClock] = useState<ClockSample | null>(null);
  const [observations, setObservations] = useState<ListenerObservations>(
    () => ({
      ready: new Map(),
      caption: new Map(),
      playback: new Map(),
    }),
  );
  function observePlayback(id: string, event: PlaybackObservation) {
    setObservations((previous) => ({
      ...previous,
      playback: new Map(previous.playback).set(id, event),
    }));
  }
  const [tick, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let processing = false;
    async function poll() {
      try {
        const sent = performance.now();
        const snapshot = await api<Snapshot>("/" + id + "/timeline");
        if (!live) return;
        const received = performance.now();
        const sample = alignClock(sent, received, snapshot.serverTime);
        const observed = Math.round(received + sample.offset);
        setClock(sample);
        setObservations((previous) => {
          const ready = new Map(previous.ready);
          const caption = new Map(previous.caption);
          for (const turn of snapshot.turns)
            if (turn.stage === "ready" && !ready.has(turn.id))
              ready.set(turn.id, observed);
          for (const liveCaption of snapshot.captions) {
            const interim = liveCaption.interimAt;
            if (interim === undefined || caption.has(interim)) continue;
            const speaker = snapshot.members.find(
              (member) => member.id === liveCaption.speaker,
            );
            if (
              liveCaption.translated ||
              speaker?.speaking === snapshot.me.listening
            )
              caption.set(interim, observed);
          }
          return { ...previous, ready, caption };
        });
        setState(snapshot);
        setNow(Date.now());
        setConnection("");
        const pending = snapshot.turns.find(
          (t) => t.stage !== "ready" && !t.error && !t.busy,
        );
        if (
          snapshot.members.length >= 2 &&
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
      if (own)
        setShare(
          location.origin +
            "/room/" +
            id +
            (sessionStorage.getItem("meeting-" + id) ? "?meeting=1" : "") +
            "#invite=" +
            own,
        );
      timer = setTimeout(poll, document.hidden ? 2500 : 650);
    }
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [id, tick]);
  if (!state && invite)
    return (
      <Entry
        id={id}
        invite={invite}
        liveVoiceAvailable={liveVoiceAvailable}
        radio={radio}
        meeting={new URLSearchParams(location.search).has("meeting")}
      />
    );
  if (!state)
    return (
      <main>
        <h1>Conversation room</h1>
        <p role="status">{connection || "Opening room…"}</p>
        <Link href="/">Create a room</Link>
      </main>
    );
  const active = state.room.status === "active";
  const meeting = state.room.transport === "livekit";
  const drafts = (state.captions ?? []).filter(
    (c) =>
      state.canRecord &&
      c.text &&
      !state.turns.some((t) => t.phrase_id === c.key),
  );
  const interpreted = meeting && !!state.liveMedia;
  const captionCards = drafts.map((caption) => (
    <div
      className={
        "chat-message live-caption " +
        (caption.speaker === state.me.id ? "own" : "incoming")
      }
      key={caption.key}
      data-has-speech="true"
      role="status"
    >
      <small>
        {state.members.find((m) => m.id === caption.speaker)?.name} · Live
        caption
      </small>
      {caption.speaker === state.me.id ||
      state.me.listening ===
        state.members.find((m) => m.id === caption.speaker)?.speaking ? (
        <p>{caption.text}</p>
      ) : (
        <>
          <p lang={caption.target}>{caption.translated || "Translating…"}</p>
          {caption.translated && <small>Draft translation</small>}
          <details>
            <summary>Original</summary>
            <p>{caption.text}</p>
          </details>
        </>
      )}
    </div>
  ));
  return (
    <main className="call-workspace">
      <p className="eyebrow">
        {meeting ? "Meeting room" : "Audio call"} · {active ? "Live" : "Ended"}{" "}
        ·{" "}
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
      {interpreted &&
        active &&
        (state.canRecord && !connection ? (
          <InterpretedMeeting
            key={state.room.media_epoch}
            id={id}
            me={state.me}
            members={state.members}
            processing={state.interpretationState}
            radio={state.radio}
            issue={state.meetingIssues?.[state.me.id]}
            onDecoded={(segment, at) => {
              if (clock)
                observePlayback(segment, {
                  started: Math.round(at + clock.offset),
                  uncertainty: clock.uncertainty + 40,
                  decoded: true,
                });
            }}
          />
        ) : (
          <section
            className="audio-console waiting-console"
            aria-label="Interpreted meeting audio"
          >
            <h2>Meeting audio</h2>
            <p role="status">
              {connection
                ? "Checking the room connection…"
                : state.members.length < 2
                  ? "Invite someone to start the call."
                  : "Waiting for everyone’s consent to enable audio."}
            </p>
          </section>
        ))}
      <div
        className={
          "split call-layout" + (interpreted ? " interpreted-layout" : "")
        }
      >
        <section className="room-panel">
          <h2>
            Participants
            {interpreted && (
              <span className="seat-count">{state.members.length}</span>
            )}
          </h2>
          <div className={interpreted ? "participant-tiles" : undefined}>
            {state.members.map((m) => (
              <div className="member" key={m.id}>
                <span aria-hidden="true" className="avatar">
                  {Array.from(m.name)[0]}
                </span>
                <strong>
                  {m.name}
                  {m.id === state.me.id ? " (you)" : ""}
                </strong>
                <small>
                  {meeting ? "Listens in " : ""}
                  {languages[m.listening]} ·{" "}
                  {m.consented_at ? "Consented" : "Consent withdrawn"} ·{" "}
                  {m.recording
                    ? "Recording"
                    : now - Date.parse(m.last_seen) < 20000
                      ? "Present"
                      : "Away"}
                </small>
                {interpreted && active && state.canRecord && (
                  <small className="mic-status">
                    {connection
                      ? "Checking microphone..."
                      : state.connectedMicrophones?.includes(m.id)
                        ? "Microphone connected"
                        : "Microphone not connected"}
                  </small>
                )}
              </div>
            ))}
          </div>
          {interpreted && active && (
            <div className="transcript-panel">
              <h3>Live transcript</h3>
              {state.canRecord ? (
                <MeetingCaptions
                  members={state.members}
                  me={state.me}
                  drafts={drafts}
                  radio={!!state.radio}
                  radioCaptions={state.radioCaptions}
                />
              ) : (
                <p>Waiting for participants and consent.</p>
              )}
            </div>
          )}
          {share && state.members.length < (meeting ? 6 : 2) && active && (
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
            <>
              {!interpreted && (
                <LiveConversation
                  key={state.room.media_epoch}
                  room={id}
                  meeting={meeting}
                  me={state.me}
                  peer={state.members.find((m) => m.id !== state.me.id)!}
                  caption={
                    state.captions?.find((c) => c.speaker === state.me.id) ??
                    state.caption
                  }
                  turns={state.turns}
                  refresh={refresh}
                  clock={clock}
                  onPlayback={observePlayback}
                />
              )}
            </>
          ) : (
            (!interpreted || !active) && (
              <p>
                {connection
                  ? "Recording paused while reconnecting."
                  : active
                    ? meeting
                      ? "Meeting audio needs at least two members and everyone’s consent."
                      : "Recording requires two consenting participants."
                    : "This room has ended."}
              </p>
            )
          )}
          {active && (
            <button
              className="secondary"
              onClick={async () => {
                try {
                  await api("/" + id + "/consent", {
                    accepted: !state.me.consented_at,
                    consentVersion: meeting ? meetingConsent : consentVersion,
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
                  refresh();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              End call
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
          <h2>{interpreted ? "Conversation history" : "Conversation"}</h2>
          {(!interpreted || !state.canRecord || !active || connection) &&
            state.meetingIssues?.[state.me.id] && (
              <p role="alert">{state.meetingIssues[state.me.id]}</p>
            )}
          {!state.replays?.length &&
            !state.turns.length &&
            (interpreted || !state.caption?.text) && (
              <p className="empty-chat">
                {active
                  ? interpreted
                    ? "Original recordings and translated replays appear here after each turn."
                    : "Voice messages and captions appear here as you speak."
                  : "No voice messages."}
              </p>
            )}
          {!!state.replays?.length && (
            <div aria-label="Your interpreted replays">
              <h3>Your interpreted replays</h3>
              {state.replays.map((clip) => (
                <article key={clip.id} className="chat-message">
                  <strong>
                    {state.members.find((m) => m.id === clip.speaker_id)
                      ?.name ?? "Participant"}
                  </strong>
                  <small>
                    {" "}
                    · {languages[clip.target]} ·{" "}
                    {new Date(clip.started_at).toLocaleTimeString()}
                  </small>
                  {clip.caption && (
                    <p lang={clip.target}>
                      <small>Live caption excerpt</small>
                      <br />
                      {clip.caption}
                    </p>
                  )}
                  <audio
                    preload="none"
                    controls
                    aria-label={
                      "Replay incoming audio in " + languages[clip.target]
                    }
                    src={"/api/v1/rooms/" + id + "/replays/" + clip.id}
                  />
                </article>
              ))}
            </div>
          )}
          {state.turns.map((t) => (
            <TurnCard
              key={t.phrase_id ?? t.id}
              room={id}
              turn={t}
              name={
                state.members.find((m) => m.id === t.speaker_id)?.name ??
                "Participant"
              }
              own={state.me.id === t.speaker_id}
              playing={
                !interpreted &&
                !!observations.playback.get(t.id) &&
                !observations.playback.get(t.id)?.ended &&
                state.canRecord &&
                !connection
              }
              active={
                state.members.every((m) => m.consented_at) &&
                (active || t.revision > 0 || !!t.raw_text || !!t.draft_text)
              }
              onUpdate={refresh}
            />
          ))}
          {!interpreted && captionCards}
        </section>
      </div>
      <Rehearsal
        turns={state.turns.filter((turn) => turn.speaker_id !== state.me.id)}
        observations={observations}
      />
      {(connection || error) && <p role="alert">{connection || error}</p>}
    </main>
  );
}
