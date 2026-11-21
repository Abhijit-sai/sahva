"use client";
import { useEffect, useRef, useState } from "react";
import { languages, type Language, type Member } from "../lib/shared";
import type { TurnView } from "./turn-card";
import { openLiveMicrophone } from "./live-microphone";

export type Caption = {
  speaker: string;
  text: string;
  final: boolean;
  translated: string;
  target: Language;
};
type Props = {
  room: string;
  me: Member;
  peer: Member;
  caption: Caption | null;
  turns: TurnView[];
  refresh: () => void;
};
export function LiveConversation({
  room,
  me,
  peer,
  caption,
  turns,
  refresh,
}: Props) {
  const [mode, setMode] = useState<"idle" | "opening" | "speaking" | "saving">(
    "idle",
  );
  const [words, setWords] = useState(""),
    [error, setError] = useState(""),
    [listening, setListening] = useState(false);
  const [playing, setPlaying] = useState(false);
  const active = useRef<AbortController | null>(null),
    stop = useRef<(() => Promise<void>) | null>(null);
  const player = useRef<AudioContext | null>(null),
    playSource = useRef<AudioBufferSourceNode | null>(null);
  const [heard, setHeard] = useState(() => new Set<string>());
  const [playTick, advance] = useState(0);
  useEffect(
    () => () => {
      active.current?.abort();
      void player.current?.close().catch(() => {});
    },
    [],
  );
  // Play one incoming turn at a time, in timeline order. Defer playback while either microphone is open.
  const nextIncoming = turns.find(
    (t) => t.speaker_id !== me.id && !heard.has(t.id) && !t.error,
  );
  const incomingId = nextIncoming?.stage === "ready" ? nextIncoming.id : null,
    synthetic = nextIncoming?.voice;
  useEffect(() => {
    if (
      !listening ||
      mode !== "idle" ||
      me.recording ||
      peer.recording ||
      playSource.current ||
      !player.current
    )
      return;
    if (!incomingId) return;
    const id = incomingId;
    const ctx = player.current;
    let live = true;
    const abort = new AbortController();
    async function play() {
      const kind = synthetic ? "translation" : "original";
      const response = await fetch(
        "/api/v1/rooms/" + room + "/media/" + id + "?kind=" + kind,
        { signal: abort.signal },
      );
      if (!response.ok) throw Error("Could not load the incoming voice.");
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (!live) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (playSource.current === source) {
          playSource.current = null;
          setPlaying(false);
          advance((n) => n + 1);
        }
      };
      playSource.current = source;
      setHeard((prev) => new Set([...prev, id]));
      source.start();
      setPlaying(true);
    }
    void play().catch(() => {
      if (live) {
        setError(
          "Automatic playback paused. Enable it again or play the turn in the timeline.",
        );
        setListening(false);
      }
    });
    return () => {
      live = false;
      abort.abort();
    };
  }, [
    incomingId,
    synthetic,
    me.recording,
    peer.recording,
    room,
    listening,
    mode,
    playTick,
  ]);
  async function toggleSound() {
    if (listening) {
      playSource.current?.stop();
      setListening(false);
      return;
    }
    try {
      player.current ??= new AudioContext();
      await player.current.resume();
      setHeard(
        (prev) =>
          new Set([
            ...prev,
            ...turns.filter((t) => t.stage === "ready").map((t) => t.id),
          ]),
      );
      setListening(true);
      setError("");
    } catch {
      setError("Allow audio playback in this browser and try again.");
    }
  }
  async function start() {
    if (active.current) return;
    setWords("");
    setError("");
    setMode("opening");
    const controller = new AbortController();
    active.current = controller;
    const reset = () => {
      if (active.current === controller) {
        active.current = null;
        stop.current = null;
        setMode("idle");
        refresh();
      }
    };
    try {
      const finish = await openLiveMicrophone(
        room,
        controller.signal,
        () => setMode("speaking"),
        setWords,
        reset,
        (msg) => {
          if (!controller.signal.aborted) {
            setError(msg);
            reset();
          }
        },
      );
      if (!controller.signal.aborted) stop.current = finish;
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
      reset();
    }
  }
  const last = turns.at(-1);
  const text = caption?.text || (mode === "speaking" ? words : "");
  return (
    <div className="live-box">
      <div className="live-heading">
        <h3>Live interpreter</h3>
        <span>
          {playing
            ? "Playing voice"
            : mode === "speaking"
              ? "Mic on"
              : peer.recording
                ? "Listening"
                : "Ready"}
        </span>
      </div>
      <p className="live-route">
        You speak {languages[me.speaking]}. {peer.name} listens in{" "}
        {languages[peer.listening]}.
      </p>
      {mode === "speaking" ? (
        <button
          onClick={() => {
            setMode("saving");
            void stop.current?.();
          }}
        >
          Finish phrase
        </button>
      ) : (
        <button
          disabled={mode !== "idle" || peer.recording || playing}
          onClick={() => void start()}
        >
          {mode === "opening"
            ? "Opening microphone…"
            : mode === "saving"
              ? "Saving phrase…"
              : "Speak live"}
        </button>
      )}
      <button
        className="secondary"
        aria-pressed={listening}
        onClick={() => void toggleSound()}
      >
        {listening ? "Mute incoming voice" : "Enable incoming voice"}
      </button>
      <div className="live-caption" data-has-speech={!!text} role="status">
        <small>
          {caption
            ? (caption.speaker === me.id ? "You" : peer.name) +
              " · Live caption"
            : "Live caption"}
        </small>
        <p>
          {text ||
            (mode === "speaking"
              ? "Listening…"
              : "Tap Speak live. Pause after a phrase to send it.")}
        </p>
      </div>
      {caption?.translated && (
        <div className="live-translation" aria-live="polite">
          <small>{languages[caption.target]} · Draft translation</small>
          <p>{caption.translated}</p>
        </div>
      )}
      {!caption && last?.translated_text && (
        <div className="live-translation">
          <small>
            {languages[last.target]} ·{" "}
            {last.source === last.target ? "Original" : "Translation"}
          </small>
          <p>{last.translated_text}</p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
