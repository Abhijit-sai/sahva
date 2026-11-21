import WebSocket from "ws";
import { candidates, eligible, setupIssue, type Lang } from "./catalog.ts";
import type { Hooks } from "./engines.ts";

// Linear 16 → 24 kHz interpolation. Keep one sample across packet boundaries.
export class Pcm24 {
  private carry = Buffer.alloc(0);
  private phase = 0;
  convert(frame: Buffer, final = false) {
    const input = Buffer.concat([this.carry, frame]);
    const count = input.length / 2;
    const out = Buffer.alloc(Math.ceil(count * 1.5) * 2);
    let n = 0;
    while (this.phase < count * 3) {
      const i = Math.floor(this.phase / 3),
        f = this.phase % 3;
      if (!final && f && i + 1 === count) break;
      const a = input.readInt16LE(i * 2),
        b = input.readInt16LE(Math.min(i + 1, count - 1) * 2);
      out.writeInt16LE(Math.round((a * (3 - f) + b * f) / 3), n);
      n += 2;
      this.phase += 2;
    }
    const consumed = Math.min(count, Math.floor(this.phase / 3));
    this.phase -= consumed * 3;
    this.carry = Buffer.from(input.subarray(consumed * 2));
    return out.subarray(0, n);
  }
}

export async function realtime(
  engine: "openai" | "qwen",
  source: Lang,
  target: Lang,
  hooks: Hooks,
) {
  if (!eligible(engine, source, target))
    throw Error("Unsupported spoken direction");
  const issue = setupIssue(engine);
  if (issue) throw Error(issue);
  const openai = engine === "openai";
  const url = openai
    ? "wss://api.openai.com/v1/realtime/translations"
    : "wss://" +
      process.env.DASHSCOPE_WORKSPACE_ID +
      "." +
      process.env.DASHSCOPE_REGION +
      ".maas.aliyuncs.com/api-ws/v1/realtime";
  const key = openai
    ? process.env.OPENAI_API_KEY
    : process.env.DASHSCOPE_API_KEY;
  const ws = new WebSocket(url + "?model=" + candidates[engine].model, {
    headers: { Authorization: "Bearer " + key },
    handshakeTimeout: 12000,
    maxPayload: 2000000,
  });
  const ready = Promise.withResolvers<void>(),
    drained = Promise.withResolvers<void>();
  void drained.promise.catch(() => {});
  let failure: Error | undefined,
    finished = false;
  const fail = (reason: string) => {
    failure ??= Error(reason);
    ready.reject(failure);
    drained.reject(failure);
  };
  const send = (packet: object) => {
    if (failure) throw failure;
    if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256000)
      throw Error("Translation connection unavailable or backed up");
    ws.send(JSON.stringify(packet));
  };
  ws.on("unexpected-response", (req, res) => {
    fail("Provider handshake HTTP " + res.statusCode);
    res.destroy();
    req.destroy();
  });
  ws.on("error", () => fail("Provider WebSocket transport failed"));
  ws.on("close", (code) => {
    if (!finished) fail("Provider closed before finalization (" + code + ")");
  });
  ws.on("message", (raw) => {
    try {
      const e = JSON.parse(raw.toString());
      switch (e.type) {
        case "session.created":
          send({
            type: "session.update",
            session: openai
              ? {
                  audio: {
                    input: { transcription: { model: "gpt-realtime-whisper" } },
                    output: { language: target },
                  },
                }
              : {
                  output_modalities: ["text", "audio"],
                  translation: { language: target },
                  enable_voice_clone: false,
                  voice: "Tina",
                },
          });
          break;
        case "session.updated":
          ready.resolve();
          break;
        case "session.input_transcript.delta":
          if (typeof e.delta === "string") hooks.text("source", e.delta);
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (typeof e.transcript === "string")
            hooks.text("source", e.transcript + " ", true);
          break;
        case "session.output_transcript.delta":
        case "response.audio_transcript.delta":
          if (typeof e.delta === "string") hooks.text("target", e.delta);
          break;
        case "session.output_audio.delta":
        case "response.audio.delta": {
          if (typeof e.delta !== "string") throw Error("Invalid PCM");
          const bytes = Buffer.from(e.delta, "base64");
          if (!bytes.length || bytes.length % 2) throw Error("Invalid PCM");
          hooks.audio(bytes, "pcm");
          break;
        }
        case "error":
          fail(
            "Provider error: " +
              String(e.error?.code ?? e.code ?? "request_failed")
                .replace(/[^a-zA-Z0-9_-]/g, "")
                .slice(0, 80),
          );
          break;
        case "response.done":
          if (e.response?.status && e.response.status !== "completed")
            fail("Incomplete provider response");
          break;
        case "session.closed":
        case "session.finished":
          finished = true;
          drained.resolve();
          break;
      }
    } catch {
      fail("Invalid translation session event");
    }
  });
  const setup = setTimeout(() => fail("Translation setup timed out"), 15000);
  try {
    await ready.promise;
  } catch (e) {
    ws.terminate();
    throw e;
  } finally {
    clearTimeout(setup);
  }
  const resample = new Pcm24();
  const append = (pcm: Buffer) => {
    if (pcm.length)
      send({
        type: openai
          ? "session.input_audio_buffer.append"
          : "input_audio_buffer.append",
        audio: pcm.toString("base64"),
      });
  };
  return {
    feed(frame: Buffer) {
      append(openai ? resample.convert(frame) : frame);
    },
    check() {
      if (failure) throw failure;
    },
    async finish() {
      if (openai) append(resample.convert(Buffer.alloc(0), true));
      send({ type: openai ? "session.close" : "session.finish" });
      const timeout = setTimeout(
        () => fail("Timed out draining translation"),
        20000,
      );
      try {
        await drained.promise;
      } finally {
        clearTimeout(timeout);
      }
    },
    close() {
      ws.terminate();
    },
  };
}
