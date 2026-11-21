import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { startEngine } from "../scripts/s2st/lab-engine";

const packets: string[] = [];
vi.mock("ws", () => ({
  default: class extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    constructor() {
      super();
      queueMicrotask(() => this.emit("open"));
    }
    send(packet: string) {
      packets.push(packet);
      if (JSON.parse(packet).setup)
        this.emit("message", '{"setupComplete":{}}');
    }
    terminate() {}
  },
}));

it.each([
  ["te", "en"],
  ["en", "te"],
  ["hi", "en"],
  ["en", "hi"],
] as const)(
  "changes only setup instructions on the %s to %s stream",
  async (source, target) => {
    vi.stubEnv("GEMINI_API_KEY", "offline-fixture");
    try {
      const runs = [];
      for (const conversation of [false, true]) {
        packets.length = 0;
        const hooks = {
          audio: vi.fn(),
          text: vi.fn(),
          event: vi.fn(),
          usage: vi.fn(),
        };
        const live = await startEngine(
          "gemini",
          source,
          target,
          hooks,
          conversation,
        );
        live.feed(Buffer.from([1, 0, 2, 0]));
        live.feed(Buffer.alloc(3200)); // An in-stream pause.
        live.feed(Buffer.from([3, 0]));
        await live.finish();
        live.close();
        runs.push(packets.map((p) => JSON.parse(p)));
      }
      const [baseline, meeting] = runs;
      const setup = meeting[0].setup;
      expect(setup.generationConfig.translationConfig.targetLanguageCode).toBe(
        target,
      );
      expect(setup.inputAudioTranscription.languageCodes).toEqual([source]);
      const instruction = setup.systemInstruction.parts[0].text;
      expect(
        instruction.startsWith(
          baseline[0].setup.systemInstruction.parts[0].text,
        ),
      ).toBe(true);
      expect(instruction).toContain("When uncertain, preserve it");
      expect({
        ...setup,
        systemInstruction: baseline[0].setup.systemInstruction,
      }).toEqual(baseline[0].setup);
      expect(meeting.slice(1)).toEqual(baseline.slice(1));
      expect(meeting).toHaveLength(5);
      expect(meeting[3].realtimeInput.audio.data).toBe(
        Buffer.from([3, 0]).toString("base64"),
      );
      expect(meeting[4]).toEqual({ realtimeInput: { audioStreamEnd: true } });
    } finally {
      vi.unstubAllEnvs();
    }
  },
);
it.each([
  ["fr", "zh-Hant"],
  ["pt-BR", "fil"],
  ["te", "hi"],
  ["hi", "te"],
] as const)(
  "configures direct interpretation from %s to %s without truncating the language tag",
  async (source, target) => {
    vi.stubEnv("GEMINI_API_KEY", "offline-fixture");
    packets.length = 0;
    try {
      const { gemini } = await import("../lib/providers/gemini-interpretation");
      const live = await gemini(
        source,
        target,
        { audio: vi.fn(), text: vi.fn(), event: vi.fn(), usage: vi.fn() },
        { hintSourceLanguage: true, conversation: true },
      );
      const setup = JSON.parse(packets[0]).setup;
      expect(setup.inputAudioTranscription.languageCodes).toEqual([source]);
      expect(setup.generationConfig.translationConfig.targetLanguageCode).toBe(
        target,
      );
      expect(setup.systemInstruction.parts[0].text).toContain(
        "When uncertain, preserve it",
      );
      live.close();
    } finally {
      vi.unstubAllEnvs();
    }
  },
);
