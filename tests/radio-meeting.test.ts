import { expect, it, vi } from "vitest";
import { RadioMeeting, RadioMix } from "../lib/server/radio-meeting";
import type { gemini } from "../lib/providers/gemini-interpretation";

it("renders both directions independently and closes the scoped publishers on withdrawal", async () => {
  vi.useFakeTimers();
  const stop = new AbortController();
  const rooms = new Map<
    string,
    { frames: number[]; close: ReturnType<typeof vi.fn> }
  >();
  const inputs = new Map<string, number[]>();
  const voices = new Map<string, (value: number) => void>();
  const sessionClosed = vi.fn();
  const translate: typeof gemini = async (src, dst, hooks) => {
    const direction = src + "/" + dst;
    expect(inputs.has(direction)).toBe(false);
    const mic: number[] = [];
    inputs.set(direction, mic);
    voices.set(direction, (value) => {
      hooks.audio(Buffer.from(new Int16Array(480).fill(value).buffer), "pcm");
      hooks.text("source", src, true);
      hooks.text("target", dst, true);
    });
    return {
      feed: (pcm) => {
        mic.push(pcm.readInt16LE());
      },
      check() {},
      async finish() {},
      close: sessionClosed,
    };
  };
  const bridge = new RadioMeeting(
    async (room, name, publisher) => {
      expect(publisher).toBe("radio-" + name.split("/")[3]);
      const record = { frames: [] as number[], close: vi.fn() };
      rooms.set(room + "/" + name, record);
      return {
        async write(frame) {
          record.frames.push(frame[479]);
        },
        async drain() {},
        async close() {
          record.close();
        },
      };
    },
    new Map(),
    translate,
  );
  try {
    bridge.listen("a", "te-IN", "a-private", stop.signal);
    bridge.listen("b", "en-IN", "b-private", stop.signal);
    const a = bridge.source("a", "te-IN", "mic-a", stop.signal);
    const b = bridge.source("b", "en-IN", "mic-b", stop.signal);
    bridge.listen("c", "en-IN", "c-private", stop.signal);
    await vi.advanceTimersByTimeAsync(0);
    expect([...inputs.keys()].sort()).toEqual(["en/en", "en/te", "te/en"]);
    for (let tick = 0; tick < 70; tick++) {
      a(new Int16Array(320).fill(10000));
      b(new Int16Array(320).fill(5000));
      if (tick >= 5 && tick < 22) voices.get("te/en")!(3000);
      if (tick >= 12 && tick < 35) voices.get("en/te")!(2000);
      await vi.advanceTimersByTimeAsync(20);
    }
    const toB = rooms.get("b-private/radio/en-IN/a/mic-a")!.frames;
    const toA = rooms.get("a-private/radio/te-IN/b/mic-b")!.frames;
    expect([...rooms.keys()].sort()).toEqual([
      "a-private/radio/te-IN/b/mic-b",
      "b-private/radio/en-IN/a/mic-a",
      "c-private/radio/en-IN/a/mic-a",
      "c-private/radio/en-IN/b/mic-b",
    ]);
    expect(toB[0]).toBe(10000);
    expect(toA[0]).toBe(5000);
    expect(toB[18]).toBe(4000);
    expect(toA[22]).toBe(2500);
    expect(toA.at(-1)).toBeGreaterThan(4900);
    expect(toB.at(-1)).toBeGreaterThan(9900);
    expect(inputs.get("te/en")).toEqual(Array(70).fill(10000));
    expect(inputs.get("en/te")).toEqual(Array(70).fill(5000));
    expect(bridge.captions("a")).toMatchObject([
      { speaker: "b", original: "en", translation: "te" },
    ]);
    expect(bridge.captions("b")).toMatchObject([
      { speaker: "a", original: "te", translation: "en" },
    ]);
    stop.abort();
    await vi.advanceTimersByTimeAsync(100);
    expect(bridge.captions("b")).toEqual([]);
    expect(sessionClosed).toHaveBeenCalledTimes(3);
    for (const record of rooms.values())
      expect(record.close).toHaveBeenCalledOnce();
  } finally {
    stop.abort();
    vi.useRealTimers();
  }
});

it("leaves original speech up under silent PCM and bounds peaks on a loud onset", () => {
  const mix = new RadioMix();
  const original = new Int16Array(320).fill(20000);
  expect([...mix.render(original, new Int16Array(480))]).toEqual(
    Array(480).fill(20000),
  );
  const loud = mix.render(original, new Int16Array(480).fill(32000));
  expect(loud[0]).toBe(32767);
  expect(Math.min(...loud)).toBeGreaterThan(0);
});
it("archives only PCM accepted on the individual receiver publication", async () => {
  vi.useFakeTimers();
  const stop = new AbortController();
  const accepted: Buffer[] = [],
    archived: Buffer[] = [];
  let output: ((pcm: Buffer) => void) | undefined;
  let writes = 0;
  const issues = new Map<string, string>();
  const translate: typeof gemini = async (_source, _target, hooks) => {
    output = (bytes) => hooks.audio(bytes, "pcm");
    return { feed() {}, check() {}, async finish() {}, close() {} };
  };
  const empty = { frame() {}, transcript() {}, close() {} };
  const bridge = new RadioMeeting(
    async () => ({
      async write(frame) {
        if (++writes === 4) throw Error("fixture disconnect");
        accepted.push(
          Buffer.from(
            new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength),
          ),
        );
      },
      async drain() {},
      async close() {},
    }),
    issues,
    translate,
    {
      original: () => empty,
      replay: () => ({
        ...empty,
        frame(bytes) {
          archived.push(Buffer.from(bytes));
        },
      }),
    },
  );
  try {
    bridge.listen("receiver", "zh-Hant", "private", stop.signal);
    const feed = bridge.source("speaker", "fr", "mic", stop.signal);
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 4; i++) {
      feed(new Int16Array(320).fill(4000));
      output!(Buffer.from(new Int16Array(480).fill(2000 + i).buffer));
      await vi.advanceTimersByTimeAsync(20);
    }
    expect(writes).toBe(4);
    expect(accepted).toHaveLength(3);
    expect(archived).toEqual(accepted);
    expect(issues.get("receiver")).toMatch(/disconnected/i);
  } finally {
    stop.abort();
    vi.useRealTimers();
  }
});
