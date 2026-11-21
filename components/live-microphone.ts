import { api } from "./client";

// One microphone lease covers one phrase. Keep the upload queue bounded even on slow Wi-Fi.
export async function openLiveMicrophone(
  room: string,
  signal: AbortSignal,
  onListening: () => void,
  onText: (text: string) => void,
  onSaved: () => void,
  onError: (message: string) => void,
) {
  const path = "/" + room + "/live/";
  const ctx = new AudioContext({ sampleRate: 16000 });
  let stream: MediaStream | undefined,
    key: string | undefined,
    node: AudioWorkletNode | undefined;
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
    if (node) {
      node.port.onmessage = null;
      node.disconnect();
    }
    stream?.getTracks().forEach((t) => t.stop());
    if (ctx.state !== "closed") void ctx.close().catch(() => {});
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
      try {
        await api(path + "finish", { key });
      } catch (e) {
        if (!(e instanceof TypeError) || disposed) throw e;
        await api(path + "finish", { key });
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
  try {
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    signal.throwIfAborted();
    await ctx.audioWorklet.addModule("/live-pcm.js");
    signal.throwIfAborted();
    key = (await api<{ key: string }>(path + "start", {})).key;
    signal.throwIfAborted();
    node = new AudioWorkletNode(ctx, "sahva-pcm");
    ctx.createMediaStreamSource(stream).connect(node);
    node.connect(ctx.destination);
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (stopped) return;
      if (queued >= 12) {
        fail(
          Error("The microphone connection fell behind. Try a shorter phrase."),
        );
        return;
      }
      const audio = btoa(String.fromCharCode(...new Uint8Array(e.data)));
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
    };
    timer = setTimeout(() => void finish(), 25000);
    onListening();
    return finish;
  } catch (e) {
    cancel();
    signal.removeEventListener("abort", cancel);
    throw e;
  }
}
