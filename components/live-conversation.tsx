"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { languages, type Language, type Member } from "../lib/shared";
import type { TurnView } from "./turn-card";
import type { ClockSample } from "../lib/rehearsal";
import type { PlaybackObservation } from "./rehearsal";
import { armHandsFree } from "./hands-free";
import { Recorder } from "./recorder";
import { RoomRequestError } from "./client";
import { openLiveMicrophone, type PhraseInput } from "./live-microphone";

export type Caption = {
  speaker: string;
  interimAt?: number;
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
  clock: ClockSample | null;
  onPlayback: (id: string, event: PlaybackObservation) => void;
};
export function LiveConversation({
  room,
  me,
  peer,
  caption,
  turns,
  refresh,
  clock,
  onPlayback,
}: Props) {
  const [mode, setMode] = useState<"idle" | "opening" | "speaking" | "saving">(
    "idle",
  );
  const [words, setWords] = useState(""),
    [error, setError] = useState(""),
    [listening, setListening] = useState(false);
  const [hands, setHands] = useState<"off" | "starting" | "armed">("off");
  const [manualBusy, setManualBusy] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const allowVoiceInterrupt = useRef(false);
  const monitor = useRef<AbortController | null>(null);
  const blocked = useRef(false),
    echoUntil = useRef(0);
  const timing = useRef({ clock, onPlayback });
  useLayoutEffect(() => {
    timing.current = { clock, onPlayback };
  }, [clock, onPlayback]);
  const interrupted = useRef(false);
  function stopPlayback() {
    if (!playSource.current) return;
    interrupted.current = true;
    playSource.current.stop();
  }
  const [playing, setPlaying] = useState(false);
  const active = useRef<AbortController | null>(null),
    stop = useRef<(() => Promise<void>) | null>(null);
  const player = useRef<AudioContext | null>(null),
    playSource = useRef<AudioBufferSourceNode | null>(null);
  const [archivePlaying, setArchivePlaying] = useState(false);
  useEffect(() => {
    const media = () => Array.from(document.querySelectorAll("audio"));
    const update = () =>
      setArchivePlaying(media().some((audio) => !audio.paused && !audio.ended));
    const play = (event: Event) => {
      if (!(event.target instanceof HTMLAudioElement)) return;
      stopPlayback();
      for (const audio of media())
        if (audio !== event.target && !audio.paused) audio.pause();
      update();
    };
    document.addEventListener("play", play, true);
    document.addEventListener("pause", update, true);
    document.addEventListener("ended", update, true);
    return () => {
      document.removeEventListener("play", play, true);
      document.removeEventListener("pause", update, true);
      document.removeEventListener("ended", update, true);
    };
  }, []);
  const [heard, setHeard] = useState(
    () => new Set(turns.filter((t) => t.stage === "ready").map((t) => t.id)),
  );
  const [playTick, advance] = useState(0);
  useEffect(
    () => () => {
      monitor.current?.abort();
      monitor.current = null;
      active.current?.abort();
      active.current = null;
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
  useLayoutEffect(() => {
    allowVoiceInterrupt.current = headphones;
    blocked.current =
      peer.recording ||
      me.recording ||
      (listening && !!incomingId && !playing) ||
      manualBusy;
  }, [
    headphones,
    peer.recording,
    me.recording,
    playing,
    incomingId,
    listening,
    manualBusy,
  ]);
  useEffect(() => {
    if (
      !listening ||
      archivePlaying ||
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
      const sample = timing.current.clock;
      let observation: PlaybackObservation | undefined;
      source.onended = () => {
        if (observation && sample)
          timing.current.onPlayback(id, {
            ...observation,
            ended: Math.round(performance.now() + sample.offset),
            interrupted: interrupted.current,
          });
        if (playSource.current === source) {
          echoUntil.current = performance.now() + 350;
          playSource.current = null;
          setPlaying(false);
          advance((n) => n + 1);
        }
      };
      if (ctx.state !== "running")
        throw Error("Incoming audio needs a playback gesture.");
      source.start();
      interrupted.current = false;
      playSource.current = source;
      setHeard((prev) => new Set([...prev, id]));
      if (sample) {
        observation = {
          started: Math.round(performance.now() + sample.offset),
          uncertainty: sample.uncertainty,
        };
        timing.current.onPlayback(id, observation);
      }
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
    archivePlaying,
  ]);
  async function enableSound() {
    player.current ??= new AudioContext();
    await player.current.resume();
    setListening(true);
  }
  async function toggleSound() {
    if (listening) {
      stopPlayback();
      setListening(false);
      return;
    }
    try {
      await enableSound();
      setError("");
    } catch {
      setError("Allow audio playback in this browser and try again.");
    }
  }
  function muteMicrophone() {
    const session = monitor.current;
    if (!session) return;
    monitor.current = null;
    session.abort();
    setHands("off");
    if (stop.current) {
      setMode("saving");
      void stop.current();
    } else active.current?.abort();
  }
  async function start(
    input?: PhraseInput,
    activity?: { onset: number; lastVoiced: number },
  ) {
    const sample = timing.current.clock;
    if (active.current) return;
    if (input && allowVoiceInterrupt.current) stopPlayback();
    setWords("");
    setError("");
    setMode("opening");
    const controller = new AbortController();
    active.current = controller;
    let complete!: () => void;
    const finished = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const reset = () => {
      complete();
      if (active.current !== controller) return;
      active.current = null;
      stop.current = null;
      setMode("idle");
      refresh();
    };
    controller.signal.addEventListener("abort", reset, { once: true });
    try {
      const finish = await openLiveMicrophone(
        room,
        controller.signal,
        () => setMode("speaking"),
        setWords,
        reset,
        (message) => {
          if (!controller.signal.aborted) {
            setError(message);
            reset();
          }
        },
        input,
        () =>
          activity && sample
            ? {
                onset: Math.round(activity.onset + sample.offset),
                lastVoiced: Math.round(activity.lastVoiced + sample.offset),
                uncertainty: sample.uncertainty,
              }
            : undefined,
      );
      if (!controller.signal.aborted) stop.current = finish;
      await finished;
    } catch (e) {
      if (!controller.signal.aborted) {
        if (input && e instanceof RoomRequestError && e.code === "MIC_BUSY") {
          setError(
            "Your partner started first. Speak again when their phrase finishes.",
          );
        } else {
          setError((e as Error).message);
          if (input && monitor.current) {
            monitor.current.abort();
            monitor.current = null;
            setHands("off");
          }
        }
      }
      reset();
    } finally {
      controller.signal.removeEventListener("abort", reset);
    }
  }
  async function enableHands() {
    if (monitor.current || active.current || manualBusy) return;
    const session = new AbortController();
    monitor.current = session;
    setHands("starting");
    setError("");
    try {
      if (!listening) await enableSound();
      session.signal.throwIfAborted();
      await armHandsFree(
        session.signal,
        () =>
          blocked.current ||
          (!!playSource.current && !allowVoiceInterrupt.current) ||
          performance.now() < echoUntil.current ||
          Array.from(document.querySelectorAll("audio")).some(
            (audio) => !audio.paused && !audio.ended,
          ),
        start,
        () => {
          muteMicrophone();
          setError(
            "Microphone disconnected. Reconnect it and start hands-free again.",
          );
        },
      );
      if (!session.signal.aborted) setHands("armed");
    } catch (e) {
      if (!session.signal.aborted)
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Allow microphone access to start hands-free."
            : (e as Error).message,
        );
      if (monitor.current === session) {
        monitor.current = null;
        session.abort();
        setHands("off");
      }
    }
  }
  useEffect(() => {
    const disconnect = () => {
      if (!monitor.current && !active.current) return;
      monitor.current?.abort();
      monitor.current = null;
      active.current?.abort();
      setHands("off");
      setMode("idle");
      setError("Microphone stopped. Start hands-free again when connected.");
    };
    window.addEventListener("offline", disconnect);
    window.addEventListener("pagehide", disconnect);
    return () => {
      window.removeEventListener("offline", disconnect);
      window.removeEventListener("pagehide", disconnect);
    };
  }, []);
  return (
    <>
      <div className="live-box">
        <div className="live-heading">
          <h3>Call audio</h3>
          <span role="status">
            {playing
              ? "Playing voice"
              : mode === "speaking"
                ? "Mic on"
                : peer.recording
                  ? "Partner speaking"
                  : hands === "armed"
                    ? "Listening for your voice"
                    : "Microphone off"}
          </span>
        </div>
        <p className="live-route">
          You hear {languages[me.listening]}. {peer.name} hears{" "}
          {languages[peer.listening]}.
        </p>
        {hands === "off" ? (
          <button
            disabled={mode !== "idle" || manualBusy}
            onClick={() => void enableHands()}
          >
            Join audio call
          </button>
        ) : (
          <button onClick={muteMicrophone}>
            {hands === "starting" ? "Cancel microphone" : "Mute microphone"}
          </button>
        )}
        {playing && hands === "armed" && (
          <button className="secondary" onClick={stopPlayback}>
            Interrupt playback
          </button>
        )}
        <details className="audio-options">
          <summary>Audio options</summary>
          <button
            className="secondary"
            aria-pressed={listening}
            onClick={() => void toggleSound()}
          >
            {listening ? "Mute incoming voice" : "Enable incoming voice"}
          </button>
          {hands === "armed" && (
            <label className="check">
              <input
                type="checkbox"
                checked={headphones}
                onChange={(event) => setHeadphones(event.target.checked)}
              />
              Using headphones · speak to interrupt playback
            </label>
          )}
          {hands === "off" &&
            (mode === "speaking" ? (
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
                disabled={
                  mode !== "idle" || peer.recording || playing || manualBusy
                }
                onClick={() => void start()}
              >
                {mode === "opening"
                  ? "Opening microphone…"
                  : mode === "saving"
                    ? "Saving phrase…"
                    : "Speak live"}
              </button>
            ))}
          <div hidden={hands !== "off" || mode !== "idle"}>
            <Recorder room={room} onUploaded={refresh} onBusy={setManualBusy} />
          </div>
        </details>
        {mode === "speaking" && !caption?.text && words && (
          <p className="live-caption">{words}</p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </>
  );
}
