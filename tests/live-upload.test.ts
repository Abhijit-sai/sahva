import { expect, it, vi } from "vitest";
import { openLiveMicrophone } from "../components/live-microphone";
import type { FrameConsumer } from "../components/pcm-input";

const send = vi.hoisted(() => vi.fn());
vi.mock("../components/client", () => ({ api: send }));

it("drains buffered 200 ms frames in order before saving a manual finish", async () => {
  const gate = Promise.withResolvers<void>();
  const batches: {
    seq: number;
    first: number;
    last: number;
    length: number;
  }[] = [];
  let receive!: FrameConsumer;
  let saved = false;
  send.mockImplementation(
    async (path: string, body: { seq: number; audio: string }) => {
      if (path.endsWith("/start")) return { key: "fixture" };
      if (path.endsWith("/frame")) {
        if (body.seq === 0) await gate.promise;
        const bytes = Buffer.from(body.audio, "base64");
        batches.push({
          seq: body.seq,
          first: bytes[0],
          last: bytes.at(-1)!,
          length: bytes.length,
        });
        return { text: "", done: false };
      }
      expect(batches).toHaveLength(3);
      return {};
    },
  );
  const finish = await openLiveMicrophone(
    "fixture",
    new AbortController().signal,
    () => {},
    () => {},
    () => {
      saved = true;
    },
    (error) => {
      throw Error(error);
    },
    (cb) => {
      receive = cb;
      return () => {};
    },
  );
  for (let n = 1; n <= 5; n++) receive(new Uint8Array(6400).fill(n).buffer);
  const saving = finish();
  expect(saved).toBe(false);
  gate.resolve();
  await saving;
  expect(batches).toEqual([
    { seq: 0, first: 1, last: 1, length: 6400 },
    { seq: 1, first: 2, last: 3, length: 12800 },
    { seq: 2, first: 4, last: 5, length: 12800 },
  ]);
  expect(saved).toBe(true);
});
