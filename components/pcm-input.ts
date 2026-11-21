export type FrameConsumer = (pcm: ArrayBuffer) => void;

// The browser resamples to 16 kHz before handing frames to the existing PCM worklet.
export async function listenPcm(
  signal: AbortSignal,
  consume: FrameConsumer,
  onLost: () => void,
) {
  const context = new AudioContext({ sampleRate: 16000 });
  let stream: MediaStream | undefined;
  let node: AudioWorkletNode | undefined;
  function close() {
    signal.removeEventListener("abort", close);
    if (node) {
      node.port.onmessage = null;
      node.disconnect();
    }
    stream?.getTracks().forEach((track) => {
      track.removeEventListener("ended", onLost);
      track.stop();
    });
    if (context.state !== "closed") void context.close().catch(() => {});
  }
  signal.addEventListener("abort", close, { once: true });
  try {
    signal.throwIfAborted();
    await context.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    signal.throwIfAborted();
    await context.audioWorklet.addModule("/live-pcm.js");
    signal.throwIfAborted();
    node = new AudioWorkletNode(context, "sahva-pcm");
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => consume(e.data);
    context.createMediaStreamSource(stream).connect(node);
    node.connect(context.destination);
    for (const track of stream.getAudioTracks())
      track.addEventListener("ended", onLost, { once: true });
    return close;
  } catch (e) {
    close();
    throw e;
  }
}
