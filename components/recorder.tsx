"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./client";

export function Recorder({
  room,
  onUploaded,
  onBusy,
  voice,
}: {
  room: string;
  voice?: string;
  onUploaded: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const live = useRef(true);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [mode, setMode] = useState<
    "idle" | "permission" | "recording" | "preview" | "uploading"
  >("idle");
  useEffect(() => {
    onBusy(mode !== "idle");
  }, [mode, onBusy]);
  const [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  const [draft, setDraft] = useState<{
    blob: Blob;
    url: string;
    key: string;
  } | null>(null);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      clearTimeout(timeout.current);
      clearInterval(interval.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (draft) URL.revokeObjectURL(draft.url);
    },
    [draft],
  );
  async function start() {
    setError("");
    setMode("permission");
    const recordingKey = crypto.randomUUID();
    const release = () =>
      api("/" + room + "/recording", {
        recording: false,
        key: recordingKey,
      }).catch(() => {});
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error("Use Chrome over HTTPS or localhost to record.");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = mic;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      if (!mimeType)
        throw new Error("This browser has no supported recording format.");
      const rec = new MediaRecorder(mic, { mimeType });
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onstop = () => {
        void release();
        clearTimeout(timeout.current);
        clearInterval(interval.current);
        mic.getTracks().forEach((t) => t.stop());
        if (!live.current) return;
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (!blob.size) {
          setMode("idle");
          setError("No audio was captured. Try again.");
          return;
        }
        setDraft({
          blob,
          url: URL.createObjectURL(blob),
          key: crypto.randomUUID(),
        });
        setMode("preview");
      };
      await api("/" + room + "/recording", {
        recording: true,
        key: recordingKey,
      });
      if (!live.current) {
        mic.getTracks().forEach((t) => t.stop());
        await release();
        return;
      }
      rec.start();
      setMode("recording");
      setSeconds(0);
      const startTime = performance.now();
      interval.current = setInterval(
        () =>
          setSeconds(
            Math.min(25, Math.floor((performance.now() - startTime) / 1000)),
          ),
        200,
      );
      timeout.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 25_000);
    } catch (e) {
      void release();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (live.current) {
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone permission was denied. Allow it in your browser and try again."
            : (e as Error).message,
        );
        setMode("idle");
      }
    }
  }
  async function submit() {
    if (!draft) return;
    setError("");
    setMode("uploading");
    const data = new FormData();
    data.append("audio", draft.blob, "turn");
    data.set("idempotencyKey", draft.key);
    if (voice) data.set("voice", voice);
    try {
      await api("/" + room + "/turns", data);
      if (live.current) {
        setDraft(null);
        setMode("idle");
        onUploaded();
      }
    } catch (e) {
      if (live.current) {
        setError((e as Error).message);
        setMode("preview");
      }
    }
  }
  return (
    <div className="recorder">
      <h3>Your voice turn</h3>
      {mode === "idle" && <button onClick={start}>Record a turn</button>}
      {mode === "permission" && (
        <p role="status">Waiting for microphone permission…</p>
      )}
      {mode === "recording" && (
        <button onClick={() => recorder.current?.stop()}>
          Stop recording · {seconds}s / 25s
        </button>
      )}
      {draft && (
        <>
          <label>
            Preview original audio
            <audio controls src={draft.url} />
          </label>
          <button disabled={mode === "uploading"} onClick={submit}>
            {mode === "uploading" ? "Saving original…" : "Submit turn"}
          </button>
          <button
            className="secondary"
            disabled={mode === "uploading"}
            onClick={() => {
              setDraft(null);
              setMode("idle");
            }}
          >
            Discard
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
