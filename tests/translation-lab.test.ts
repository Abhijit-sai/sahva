import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { eligible, setupIssue } from "../scripts/s2st/catalog.ts";
import { Pcm24, realtime } from "../scripts/s2st/realtime-translate.ts";

const fake = vi.hoisted(() => ({
  sockets: [] as Array<EventEmitter & { sent: Record<string, unknown>[] }>,
}));
vi.mock("ws", () => ({
  default: class extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    sent: Record<string, unknown>[] = [];
    constructor() {
      super();
      fake.sockets.push(this);
    }
    send(s: string) {
      this.sent.push(JSON.parse(s));
    }
    terminate() {
      this.emit("close", 1000);
    }
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  fake.sockets.length = 0;
});
it("filters source and spoken target independently", () => {
  expect(eligible("openai", "te", "en")).toBe(true);
  expect(eligible("openai", "en", "te")).toBe(false);
  expect(eligible("qwen", "te", "en")).toBe(false);
  expect(eligible("qwen", "en", "hi")).toBe(true);
  expect(eligible("sarvam", "hi", "en")).toBe(false);
  expect(eligible("gemini", "hi", "hi")).toBe(false);
});
it("resamples exactly once across packet boundaries including an odd final sample", () => {
  const pcm = Buffer.alloc(3210);
  for (let i = 0; i < pcm.length; i += 2)
    pcm.writeInt16LE(Math.round(24000 * Math.sin(i / 60)), i);
  const all = new Pcm24().convert(pcm, true),
    split = new Pcm24(),
    parts = [];
  for (let i = 0; i < pcm.length; i += 22)
    parts.push(split.convert(pcm.subarray(i, i + 22)));
  parts.push(split.convert(Buffer.alloc(0), true));
  expect(Buffer.concat(parts)).toEqual(all);
  expect(all.length).toBe(Math.ceil((pcm.length / 2) * 1.5) * 2);
});
it("configures the Qwen preset and drains translated audio before close", async () => {
  vi.stubEnv("DASHSCOPE_API_KEY", "test");
  vi.stubEnv("DASHSCOPE_WORKSPACE_ID", "test");
  vi.stubEnv("DASHSCOPE_REGION", "ap-southeast-1");
  const hooks = {
    audio: vi.fn(),
    text: vi.fn(),
    event: vi.fn(),
    usage: vi.fn(),
  };
  const p = realtime("qwen", "hi", "en", hooks),
    ws = fake.sockets[0];
  const emit = (type: string, fields = {}) =>
    ws.emit("message", Buffer.from(JSON.stringify({ type, ...fields })));
  emit("session.created");
  expect(ws.sent[0]).toMatchObject({
    type: "session.update",
    session: { translation: { language: "en" }, enable_voice_clone: false },
  });
  emit("session.updated");
  const s = await p;
  s.feed(Buffer.from([1, 2]));
  const drain = s.finish();
  expect(ws.sent.slice(1)).toEqual([
    { type: "input_audio_buffer.append", audio: "AQI=" },
    { type: "session.finish" },
  ]);
  emit("response.audio.delta", { delta: "AwQ=" });
  emit("session.finished");
  await drain;
  expect(hooks.audio).toHaveBeenCalledWith(Buffer.from([3, 4]), "pcm");
  s.close();
  vi.stubEnv("DASHSCOPE_REGION", "invalid");
  expect(setupIssue("qwen")).toMatch(/region/);
});
