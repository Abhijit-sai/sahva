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
import { voices } from "../lib/voices";
import { MeetingMicrophone } from "./meeting-microphone";

type DeviceContext = AudioContext & {
  setSinkId?: (id: string) => Promise<void>;
};

export function InterpretedMeeting({
  id,
  me,
  members,
  processing,
  onDecoded,
}: {
  id: string;
  me: Member;
  members: Member[];
  processing?: "Translating" | "Catching up";
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
    me.listening === "te-IN"
      ? "tarun_te_narration"
      : voices[me.listening][0].id,
  );
  const [micMuted, setMicMuted] = useState(false);
  const [headphones, setHeadphones] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connection, setConnection] = useState<
    "off" | "listening" | "reconnecting"
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
    if (volume.current) volume.current.gain.value = muted || review ? 0 : 1;
  }, [muted, review]);

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
    gain.gain.value = reviewing.current ? 0 : 1;
    volume.current = gain;
    gain.connect(ctx.destination);
    const readers = new Map<string, () => void>();
    function clear() {
      for (const stop of readers.values()) stop();
      readers.clear();
      if (output.current === room) {
        setActive("");
        setLiveVoice(false);
      }
    }
    room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
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
      ] = pub.trackName.split("/");
      if (
        output.current !== room ||
        participant.identity !== "interpretation" ||
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
        if (voiced && !observed) {
          observed = true;
          observe.current(segment, performance.now());
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
        setLiveVoice(voiced);
        setActive(
          voiced
            ? (voice === "original"
                ? "Original audio playing · "
                : "Translated audio playing · ") + name
            : "",
        );
      }, 40);
      readers.set(pub.trackSid, () => {
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
      if (output.current === room) {
        setActive("");
        setLiveVoice(false);
      }
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
    await room.connect(url, token);
    if (output.current !== room) {
      await room.disconnect();
      throw Error("Left meeting");
    }
    setConnection("listening");
    setMessage("");
  }
  return (
    <section aria-label="Interpreted meeting audio">
      <h3>Meeting audio</h3>
      <p>
        You speak {languages[me.speaking]} and hear {languages[me.listening]}.
      </p>
      <p role="status">
        {blocked
          ? "Audio blocked"
          : connection === "reconnecting"
            ? "Reconnecting"
            : connection === "off"
              ? "Meeting audio off"
              : muted
                ? "Incoming audio muted"
                : review
                  ? "Reviewing recording"
                  : active ||
                    processing ||
                    (members.some((m) => m.recording)
                      ? "Speaker active"
                      : "Listening")}
      </p>
      {blocked && (
        <button onClick={() => void unlock()}>Enable meeting audio</button>
      )}
      {connection === "off" && (
        <button onClick={() => void unlock(true)}>Test speaker</button>
      )}
      {devices.length > 0 && (
        <label>
          Speaker{" "}
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
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Speaker " + (i + 1)}
              </option>
            ))}
          </select>
        </label>
      )}
      {connection === "off" && (
        <label>
          Incoming voice{" "}
          <select
            value={incomingVoice}
            onChange={(e) => setIncomingVoice(e.target.value)}
          >
            {voices[me.listening].map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {connection === "listening" && (
        <>
          <button
            aria-pressed={micMuted}
            onClick={() => setMicMuted(!micMuted)}
          >
            {micMuted ? "Unmute microphone" : "Mute microphone"}
          </button>
          <label>
            <input
              type="checkbox"
              checked={headphones}
              onChange={(e) => setHeadphones(e.target.checked)}
            />
            Using headphones · speak during interpretation
          </label>
        </>
      )}
      <MeetingMicrophone
        id={id}
        voice=""
        incomingVoice={incomingVoice}
        suppress={micMuted || (!headphones && liveVoice) || review}
        enableSound={unlock}
        disableSound={leave}
        connectOutput={connectOutput}
      />
      {connection === "listening" && (
        <button aria-pressed={muted} onClick={() => setMuted(!muted)}>
          {muted ? "Unmute incoming audio" : "Mute incoming audio"}
        </button>
      )}
      {message && <p role="alert">{message}</p>}
    </section>
  );
}
