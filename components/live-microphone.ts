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
    seq = 0,
    queued = 0;
  let tail = Promise.resolve();
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
      await tail;
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
  function sendFrame(frame: ArrayBuffer) {
    if (stopped || !key) return;
    if (queued >= 12) {
      fail(
        Error("The microphone connection fell behind. Try a shorter phrase."),
      );
      return;
    }
    const audio = btoa(String.fromCharCode(...new Uint8Array(frame)));
    const index = seq++;
    queued++;
    tail = tail
      .then(async () => {
        if (disposed) return;
        const reply = await api<{ text: string; done: boolean }>(
          path + "frame",
          { key, seq: index, audio },
        );
        if (disposed) return;
        if (reply.text) {
          onText(reply.text);
          if (
            !reply.done &&
            !translating &&
            lastText !== reply.text &&
            Date.now() - lastTranslation >= 1800
          ) {
            translating = true;
            lastText = reply.text;
            lastTranslation = Date.now();
            void api(path + "interpret", { key })
              .catch(() => {})
              .finally(() => {
                translating = false;
              });
          }
        }
        if (reply.done) queueMicrotask(() => void finish());
      })
      .catch(fail)
      .finally(() => {
        queued--;
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
