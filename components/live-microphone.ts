import type { CaptureTiming } from "../lib/rehearsal";
import { api } from "./client";
import { listenPcm, type FrameConsumer } from "./pcm-input";
export type PhraseInput = (receive: FrameConsumer) => () => void;

// One microphone lease covers one phrase. Keep the upload queue bounded even on slow Wi-Fi.
export async function openLiveMicrophone(
  room: string,
  signal: AbortSignal,
  onListening: () => void,
  onText: (text: string) => void,
  onSaved: () => void,
  onError: (message: string) => void,
  input?: PhraseInput,
  capture?: () => CaptureTiming | undefined,
) {
  const path = "/" + room + "/live/";
  let key: string | undefined, releaseInput: (() => void) | undefined;
  let stopped = false,
    disposed = false,
    seq = 0;
  const pending: ArrayBuffer[] = [];
  let sending: Promise<void> | null = null;
  let translating = false,
    lastTranslation = 0,
    lastText = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    clearTimeout(timer);
    releaseInput?.();
  };
  const cancel = () => {
    disposed = true;
    pending.length = 0;
    stopped = true;
    release();
    if (key) void api(path + "finish", { key, cancel: true }).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  async function finish() {
    if (stopped) return;
    stopped = true;
    release();
    try {
      await sending;
      if (disposed) return;
      const body = { key, capture: capture?.() };
      try {
        await api(path + "finish", body);
      } catch (e) {
        if (!(e instanceof TypeError) || disposed) throw e;
        await api(path + "finish", body);
      }
      if (!disposed) onSaved();
    } catch (e) {
      if (!disposed) onError((e as Error).message);
    } finally {
      signal.removeEventListener("abort", cancel);
    }
  }
  function fail(e: unknown) {
    if (stopped || disposed) return;
    const msg =
      e instanceof Error ? e.message : "Microphone connection was interrupted.";
    // Save any audio already received before offering another turn.
    void finish().then(() => {
      if (!disposed) onError(msg);
    });
  }
  async function drain() {
    while (pending.length && !disposed) {
      // One 200 ms frame on fast links. Send two together when behind.
      // 400 ms stays below the provider's 500 ms per-message limit.
      const frames = pending.splice(0, 2);
      const bytes = new Uint8Array(
        frames.reduce((n, frame) => n + frame.byteLength, 0),
      );
      let offset = 0;
      for (const frame of frames) {
        bytes.set(new Uint8Array(frame), offset);
        offset += frame.byteLength;
      }
      const audio = btoa(String.fromCharCode(...bytes));
      const reply = await api<{ text: string; done: boolean }>(path + "frame", {
        key,
        seq: seq++,
        audio,
      });
      if (disposed) return;
      if (reply.text) {
        onText(reply.text);
        if (
          !reply.done &&
          !translating &&
          lastText !== reply.text &&
          performance.now() - lastTranslation >= 1800
        ) {
          translating = true;
          lastText = reply.text;
          lastTranslation = performance.now();
          void api(path + "interpret", { key })
            .catch(() => {})
            .finally(() => {
              translating = false;
            });
        }
      }
      if (reply.done) {
        pending.length = 0;
        void finish();
        return;
      }
    }
  }
  function sendFrame(frame: ArrayBuffer) {
    if (stopped || !key) return;
    if (pending.length >= 32) {
      fail(
        Error(
          "The microphone connection fell behind. Please check the saved phrase and repeat any missing words.",
        ),
      );
      return;
    }
    pending.push(frame);
    if (!sending)
      sending = drain()
        .catch((error) => {
          pending.length = 0;
          if (stopped) throw error;
          fail(error);
        })
        .finally(() => {
          sending = null;
        });
  }
  try {
    if (!input)
      releaseInput = await listenPcm(signal, sendFrame, () =>
        fail(Error("Microphone disconnected.")),
      );
    signal.throwIfAborted();
    key = (await api<{ key: string }>(path + "start", {})).key;
    signal.throwIfAborted();
    if (input) releaseInput = input(sendFrame);
    timer = setTimeout(() => void finish(), 25000);
    onListening();
    return finish;
  } catch (e) {
    cancel();
    signal.removeEventListener("abort", cancel);
    throw e;
  }
}
