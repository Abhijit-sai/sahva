"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Room } from "livekit-client";
import { languages, type Member } from "../lib/shared";
import { rememberVoice, storedVoice, VoicePicker } from "./voice-picker";
import { api } from "./client";
import { MeetingMicrophone, type MicState } from "./meeting-microphone";

type DeviceContext = AudioContext & {
  setSinkId?: (id: string) => Promise<void>;
};

export function InterpretedMeeting({
  id,
  me,
  members,
  processing,
  radio = false,
  issue,
  onDecoded,
}: {
  id: string;
  me: Member;
  members: Member[];
  processing?: "Translating" | "Catching up";
  radio?: boolean;
  issue?: string;
  onDecoded: (segment: string, at: number) => void;
}) {
  const observe = useRef(onDecoded);
  useLayoutEffect(() => {
    observe.current = onDecoded;
  }, [onDecoded]);
  const context = useRef<DeviceContext | null>(null);
  const output = useRef<Room | null>(null);
  const volume = useRef<GainNode | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [incomingVoice, setIncomingVoice] = useState<string>(() =>
    storedVoice(id, me.id, me.listening, true),
  );
  const [savingVoice, setSavingVoice] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [micState, setMicState] = useState<MicState>("off");
  const [headphones, setHeadphones] = useState(false);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(100);
  const [connection, setConnection] = useState<
    "off" | "connecting" | "listening" | "reconnecting"
  >("off");
  const [active, setActive] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState("");
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const reviewing = useRef(false);
  const [liveVoice, setLiveVoice] = useState(false);
  const alive = useRef(true);
  const leave = useCallback(() => {
    const room = output.current;
    output.current = null;
    void room?.disconnect();
    volume.current?.disconnect();
    volume.current = null;
    if (context.current) {
      context.current.onstatechange = null;
      void context.current.close().catch(() => {});
      context.current = null;
    }
    setLiveVoice(false);
    setActive("");
    setConnection("off");
    setSavingVoice(false);
    setMuted(false);
    setMicMuted(false);
    setDevice("");
    setBlocked(false);
  }, []);
  useEffect(() => {
    alive.current = true;
    const checkReview = () => {
      reviewing.current = Array.from(document.querySelectorAll("audio")).some(
        (el) => !el.paused && !el.ended,
      );
      setReview(reviewing.current);
    };
    for (const event of ["play", "ended", "pause"])
      document.addEventListener(event, checkReview, true);
    return () => {
      alive.current = false;
      for (const event of ["play", "ended", "pause"])
        document.removeEventListener(event, checkReview, true);
      leave();
    };
  }, [leave]);
  useEffect(() => {
    if (volume.current)
      volume.current.gain.value = muted || review ? 0 : level / 100;
  }, [muted, review, level, connection]);

  async function unlock(test = false) {
    try {
      const ctx = (context.current ??= new AudioContext());
      ctx.onstatechange = () => {
        if (context.current === ctx) setBlocked(ctx.state !== "running");
      };
      // Initiate resume synchronously inside the gesture. Some mobile browsers leave it pending.
      void ctx
        .resume()
        .then(() => {
          if (context.current !== ctx) return;
          setBlocked(ctx.state !== "running");
          if (test && ctx.state === "running") {
            const tone = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.045;
            tone.connect(gain).connect(ctx.destination);
            tone.start();
            tone.stop(ctx.currentTime + 0.18);
            tone.onended = () => {
              tone.disconnect();
              gain.disconnect();
            };
          }
        })
        .catch(() => {
          if (context.current === ctx) setBlocked(true);
        });
      setBlocked(ctx.state !== "running");
      if (typeof (ctx as DeviceContext).setSinkId === "function") {
        const found = await navigator.mediaDevices.enumerateDevices();
        if (context.current === ctx)
          setDevices(
            found.filter((d) => d.kind === "audiooutput" && d.deviceId),
          );
      }
    } catch {
      setBlocked(true);
    }
  }
  async function connectOutput(url: string, token: string) {
    const { Room, RoomEvent, Track } = await import("livekit-client");
    if (!alive.current) throw Error("Left meeting");
    const ctx = context.current;
    if (!ctx) throw Error("Audio output unavailable");
    const room = new Room();
    output.current = room;
    const gain = ctx.createGain();
    gain.gain.value = reviewing.current || muted ? 0 : level / 100;
    volume.current = gain;
    gain.connect(ctx.destination);
    const readers = new Map<string, () => void>();
    const playing = new Map<string, string>();
    function reflectPlayback() {
      if (output.current !== room) return;
      setActive([...playing.values()].join(" · "));
      setLiveVoice(playing.size > 0);
    }
    function clear() {
      for (const stop of readers.values()) stop();
      readers.clear();
      if (output.current === room) {
        setActive("");
        setLiveVoice(false);
      }
    }
    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
      const fields = pub.trackName.split("/");
      const mixed = radio && fields.length === 4 && fields[0] === "radio";
      const [
        target,
        speaker,
        segment,
        sourceTrackSid,
        clockEpoch,
        startSample,
        endSample,
        revision,
        voice,
      ] = mixed ? fields.slice(1) : fields;
      if (
        output.current !== room ||
        (radio
          ? !mixed || participant.identity !== "radio-" + segment
          : participant.identity !== "interpretation") ||
        target !== me.listening ||
        speaker === me.id ||
        !segment ||
        track.kind !== Track.Kind.Audio
      )
        return;
      const name = members.find((m) => m.id === speaker)?.name ?? "Participant";
      // Chrome's WebRTC decoder needs a media element sink even when Web Audio owns output.
      const sink = new Audio();
      sink.muted = true;
      sink.srcObject = new MediaStream([track.mediaStreamTrack]);
      void sink.play().catch(() => {});
      const source = ctx!.createMediaStreamSource(sink.srcObject);
      const analyser = ctx!.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser).connect(gain);
      const samples = new Float32Array(analyser.fftSize);
      let observed = false;
      const timer = window.setInterval(() => {
        if (output.current !== room) return;
        analyser.getFloatTimeDomainData(samples);
        const voiced =
          ctx!.state === "running" &&
          gain.gain.value > 0 &&
          samples.some((s) => Math.abs(s) > 0.008);
        if (voiced && !observed && mixed) {
          observed = true;
          if (performance.getEntriesByName("sahva.receiver-mix").length >= 128)
            performance.clearMarks("sahva.receiver-mix");
          performance.mark("sahva.receiver-mix", {
            detail: { speaker, target, trackSid: pub.trackSid },
          });
        } else if (voiced && !observed) {
          observed = true;
          observe.current(segment, performance.now());
          void api("/" + id + "/meeting/decoded", {
            outputRoom: room.name,
            segment,
          }).catch(() => {});
          if (
            performance.getEntriesByName("sahva.receiver-decoded").length >= 128
          )
            performance.clearMarks("sahva.receiver-decoded");
          performance.mark("sahva.receiver-decoded", {
            detail: {
              segment,
              speaker,
              target,
              sourceTrackSid,
              clockEpoch,
              startSample,
              endSample,
              revision,
              voice,
              trackSid: pub.trackSid,
            },
          });
        }
        if (voiced)
          playing.set(
            pub.trackSid,
            (mixed
              ? "Receiving audio · "
              : voice === "original"
                ? "Original audio playing · "
                : "Translated audio playing · ") + name,
          );
        else playing.delete(pub.trackSid);
        reflectPlayback();
      }, 40);
      readers.set(pub.trackSid, () => {
        playing.delete(pub.trackSid);
        clearInterval(timer);
        source.disconnect();
        analyser.disconnect();
        sink.pause();
        sink.srcObject = null;
      });
    });
    room.on(RoomEvent.TrackUnsubscribed, (_, pub) => {
      readers.get(pub.trackSid)?.();
      readers.delete(pub.trackSid);
      reflectPlayback();
    });
    room.on(RoomEvent.Reconnecting, () => {
      if (output.current === room) setConnection("reconnecting");
    });
    room.on(RoomEvent.Reconnected, () => {
      if (output.current === room) setConnection("listening");
    });
    room.on(RoomEvent.Disconnected, () => {
      clear();
      if (output.current === room) {
        setConnection("off");
        setMessage(
          "Incoming audio disconnected. Leave and rejoin meeting audio.",
        );
      }
    });
    try {
      await room.connect(url, token);
    } catch (error) {
      if (output.current === room) {
        output.current = null;
        gain.disconnect();
        volume.current = null;
        setConnection("off");
      }
      clear();
      await room.disconnect().catch(() => {});
      throw error;
    }
    if (output.current !== room) {
      await room.disconnect();
      throw Error("Left meeting");
    }
    setConnection("listening");
    setMessage("");
  }
  async function chooseVoice(voice: string) {
    const room = output.current;
    if (room) {
      setSavingVoice(true);
      try {
        await api("/" + id + "/meeting/voice", {
          outputRoom: room.name,
          voice,
        });
        if (!alive.current || output.current !== room) return;
      } catch (error) {
        if (alive.current && output.current === room)
          setMessage((error as Error).message);
        return;
      } finally {
        if (alive.current && output.current === room) setSavingVoice(false);
      }
    }
    rememberVoice(id, me.id, me.listening, voice, true);
    setIncomingVoice(voice);
    setMessage("");
  }
  const micReady = micState === "ready";
  const micHeld = !radio && !headphones && liveVoice;
  const micStatus =
    micState === "ready"
      ? micMuted
        ? "Muted"
        : review
          ? "Paused for replay"
          : micHeld
            ? "Paused during playback"
            : "Microphone on"
      : {
          off: "Off",
          starting: "Connecting microphone…",
          reconnecting: "Reconnecting",
          failed: "Microphone unavailable",
        }[micState];
  const outputSilent = muted || level === 0;
  const listenStatus = blocked
    ? "Audio blocked"
    : connection === "off"
      ? "Off"
      : connection === "connecting"
        ? "Connecting…"
        : connection === "reconnecting"
          ? "Reconnecting"
          : outputSilent
            ? "Incoming audio muted"
            : review
              ? "Paused for replay"
              : active || processing || "Listening";
  return (
    <section className="audio-console" aria-label="Interpreted meeting audio">
      <div className="console-heading">
        <div>
          <h2>Meeting audio</h2>
          <p>
            {radio
              ? "Hear each speaker under their live Gemini interpretation."
              : "Incoming speech plays automatically in your listening language."}
          </p>
        </div>
        <MeetingMicrophone
          id={id}
          onMicState={setMicState}
          onReceiveFailed={() => setConnection("off")}
          voice=""
          incomingVoice={incomingVoice}
          suppress={micMuted || micHeld || review}
          enableSound={() => {
            setConnection("connecting");
            return unlock();
          }}
          disableSound={leave}
          connectOutput={connectOutput}
        />
      </div>
      <div className="audio-routes">
        <div className="audio-route" role="group" aria-label="Your microphone">
          <div className="route-title">
            <span>Your microphone</span>
            <strong>{languages[me.speaking]}</strong>
          </div>
          <div className="route-action">
            <span
              role="status"
              className="channel-status"
              data-active={micReady && !micMuted && !micHeld && !review}
            >
              {micStatus}
            </span>
            {micReady && (
              <button
                className="console-control"
                aria-pressed={micMuted}
                onClick={() => setMicMuted(!micMuted)}
              >
                {micMuted ? "Unmute microphone" : "Mute microphone"}
              </button>
            )}
          </div>
        </div>
        <div
          className="audio-route"
          role="group"
          aria-label="Your incoming audio"
        >
          <div className="route-title">
            <span>You hear</span>
            <strong>{languages[me.listening]}</strong>
          </div>
          <div className="route-action">
            <span
              role="status"
              className="channel-status"
              data-active={
                connection === "listening" &&
                !blocked &&
                !muted &&
                level > 0 &&
                !review
              }
            >
              {listenStatus}
            </span>
            {blocked ? (
              <button onClick={() => void unlock()}>
                Enable meeting audio
              </button>
            ) : connection === "off" ? (
              <button
                className="console-control"
                onClick={() => void unlock(true)}
              >
                Test speaker
              </button>
            ) : (
              connection === "listening" && (
                <button
                  className="console-control"
                  aria-pressed={outputSilent}
                  onClick={() => {
                    if (level === 0) setLevel(100);
                    setMuted(!outputSilent);
                  }}
                >
                  {outputSilent
                    ? "Unmute incoming audio"
                    : "Mute incoming audio"}
                </button>
              )
            )}
          </div>
        </div>
      </div>
      <div className="console-options">
        {!radio && (
          <VoicePicker
            incoming
            target={me.listening}
            value={incomingVoice}
            disabled={
              savingVoice ||
              connection === "connecting" ||
              connection === "reconnecting"
            }
            onChange={(voice) => void chooseVoice(voice)}
          />
        )}
        {connection === "listening" && (
          <label className="incoming-level">
            Listening volume
            <input
              type="range"
              min="0"
              max="100"
              value={level}
              aria-valuetext={level + "%"}
              disabled={muted}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
            <output>{level}%</output>
          </label>
        )}
        {devices.length > 0 && (
          <label>
            Speaker
            <select
              value={device}
              onChange={async (e) => {
                const next = e.target.value;
                try {
                  await context.current?.setSinkId?.(next);
                  setDevice(next);
                  setMessage("");
                } catch {
                  setMessage(
                    "Speaker switch failed. Check the system output device.",
                  );
                }
              }}
            >
              <option value="">System default</option>
              {devices
                .filter((d) => d.deviceId !== "default")
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Speaker " + (i + 1)}
                  </option>
                ))}
            </select>
          </label>
        )}
        {micReady && !radio && (
          <label className="check">
            <input
              type="checkbox"
              checked={headphones}
              onChange={(e) => setHeadphones(e.target.checked)}
            />
            Using headphones · speak during interpretation
          </label>
        )}
      </div>
      {radio && (
        <small>
          For overlapping speech, use headphones. Gemini supplies the
          interpreted voice.
        </small>
      )}
      {issue && <p role="alert">{issue}</p>}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
