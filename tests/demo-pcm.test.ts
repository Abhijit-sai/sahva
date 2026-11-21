import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

// Feed render quanta through the local worklet, including an incomplete last packet.
const code = readFileSync("scripts/s2st/demo-pcm.js", "utf8");
it.each([0, 1, 1599, 1600, 1601, 3328])(
  "flushes exactly %i captured samples",
  (length) => {
    const messages: (ArrayBuffer | string)[] = [];
    class Processor {
      port = {
        postMessage(message: ArrayBuffer | string) {
          messages.push(message);
        },
        onmessage(event: { data: string }) {
          throw Error("No processor handler for " + event.data);
        },
      };
    }
    const worklet = runInNewContext(code + "\nnew DemoPCM()", {
      AudioWorkletProcessor: Processor,
      registerProcessor() {},
    }) as Processor & { process(inputs: Float32Array[][]): boolean };
    const input = Float32Array.from({ length }, (_, i) => Math.sin(i + 1));
    for (let i = 0; i < length; i += 128)
      worklet.process([[input.subarray(i, i + 128)]]);
    worklet.port.onmessage({ data: "finish" });
    worklet.port.onmessage({ data: "finish" });
    expect(worklet.process([[Float32Array.of(1)]])).toBe(false);
    expect(messages.pop()).toBe("finished");
    const frames = messages
      .map((m) => Array.from(new Int16Array(m as ArrayBuffer)))
      .flat();
    expect(frames).toEqual(
      Array.from(input, (sample) => Math.round(sample * 32767) || 0),
    );
  },
);
