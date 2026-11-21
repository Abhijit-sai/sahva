"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { api } from "./client";

export function MeetingMicrophone({
  id,
  voice,
  suppress,
  enableSound,
  disableSound,
  connectOutput,
  incomingVoice,
}: {
  id: string;
  voice: string;
  suppress: boolean;
  enableSound: () => Promise<void>;
  disableSound: () => void;
  incomingVoice?: string;
  connectOutput?: (url: string, token: string) => Promise<void>;
}) {
  const rtc = useRef<Room | null>(null);
  const alive = useRef(true);
  const [status, setStatus] = useState<
    "off" | "connecting" | "on" | "reconnecting"
  >("off");
  const [error, setError] = useState("");
  const leave = useCallback(() => {
    const current = rtc.current;
    rtc.current = null;
    void current?.disconnect();
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      leave();
    };
  }, [leave]);
  useEffect(() => {
    const mic = rtc.current?.localParticipant.audioTrackPublications
      .values()
      .next().value?.track?.mediaStreamTrack;
    if (mic) mic.enabled = !suppress;
  }, [suppress, status]);
  async function join() {
    setStatus("connecting");
    setError("");
    try {
      await enableSound();
      const { Room, RoomEvent } = await import("livekit-client");
      const { url, token, outputToken } = await api<{
        url: string;
        token: string;
        outputToken?: string;
      }>("/" + id + "/meeting", {
        voice,
        interpreted: !!connectOutput,
        incomingVoice,
      });
      if (!alive.current) return;
      const room = new Room({
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      rtc.current = room;
      room.on(RoomEvent.Reconnecting, () => {
        if (rtc.current === room) setStatus("reconnecting");
      });
      room.on(RoomEvent.Reconnected, () => {
        if (rtc.current === room) setStatus("on");
      });
      room.on(RoomEvent.Disconnected, () => {
        if (rtc.current === room) {
          rtc.current = null;
          setStatus("off");
          disableSound();
        }
      });
      await room.connect(url, token, { autoSubscribe: false });
      if (rtc.current !== room) {
        await room.disconnect();
        return;
      }
      room.localParticipant.setTrackSubscriptionPermissions(false, [
        { participantIdentity: "interpreter", allowAll: true },
      ]);
      if (connectOutput) {
        if (!outputToken) throw Error("Interpreted output unavailable");
        await connectOutput(url, outputToken);
        if (rtc.current !== room) return;
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      if (rtc.current === room) setStatus("on");
    } catch (e) {
      leave();
      disableSound();
      if (alive.current) {
        setStatus("off");
        setError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Allow microphone access to join meeting audio."
            : "Meeting audio could not connect. Check microphone access and try again.",
        );
      }
    }
  }
  return (
    <div>
      {status === "off" ? (
        <button onClick={() => void join()}>Join meeting audio</button>
      ) : status === "connecting" ? (
        <button disabled>Connecting microphone…</button>
      ) : (
        <button
          onClick={() => {
            leave();
            disableSound();
            setStatus("off");
          }}
        >
          Leave meeting audio
        </button>
      )}
      {status === "reconnecting" && (
        <p role="status">Reconnecting microphone…</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
