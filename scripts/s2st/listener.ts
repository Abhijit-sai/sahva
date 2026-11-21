import { type Browser } from "@playwright/test";

type Player = {
  play(encoded: string, format: "pcm" | "wav"): Promise<void>;
  mark(): {
    firstVoiced: number | null;
    lastVoiced: number | null;
    ended: number | null;
    pending: number;
    gaps: number;
    discarded: number;
  };
  interrupt(): void;
};
declare global {
  interface Window {
    s2stPlayer: Player;
    sendMic(data: string): Promise<void>;
    endMic(): Promise<void>;
  }
}

export async function listener(browser: Browser, microphone: boolean) {
  const page = await browser.newPage();
  // Intercept a private loopback origin in this isolated browser. No HTTP listener or key in the page.
  await page.route("http://localhost:19751/", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><meta charset=utf-8><title>Sahva interpretation trial</title><button id="mic" hidden>Send microphone audio to Google for 25 seconds</button><h2>Source transcript</h2><p id="source"></p><h2>Translated transcript</h2><p id="target"></p>',
    });
  });
  await page.goto("http://localhost:19751/");
  await page.evaluate(async () => {
    const context = new AudioContext({ sampleRate: 24000 });
    await context.resume();
    const active = new Set<AudioBufferSourceNode>();
    let end = 0,
      firstVoiced: number | null = null,
      lastVoiced: number | null = null,
      ended: number | null = null,
      gaps = 0,
      discarded = 0;
    const clock = () => performance.timeOrigin + performance.now();
    window.s2stPlayer = {
      async play(encoded, format) {
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        let audio;
        if (format === "wav")
          audio = await context.decodeAudioData(bytes.buffer);
        else {
          const samples = new Int16Array(bytes.buffer);
          audio = context.createBuffer(1, samples.length, 24000);
          const data = audio.getChannelData(0);
          for (let i = 0; i < samples.length; i++) data[i] = samples[i] / 32768;
        }
        const start = Math.max(end, context.currentTime + 0.015);
        if (end && start - end > 0.025) gaps++;
        const data = audio.getChannelData(0);
        const scheduledAt = clock() + (start - context.currentTime) * 1000;
        for (let i = 0; i < data.length; i += 240) {
          let energy = 0;
          const n = Math.min(240, data.length - i);
          for (let k = 0; k < n; k++) energy += data[i + k] ** 2;
          if (energy / n > (180 / 32768) ** 2) {
            firstVoiced ??= scheduledAt + i / 24;
            lastVoiced = scheduledAt + (i + n) / 24;
          }
        }
        const node = context.createBufferSource();
        node.buffer = audio;
        node.connect(context.destination);
        active.add(node);
        node.onended = () => {
          active.delete(node);
          node.disconnect();
          ended = clock();
        };
        node.start(start);
        end = start + audio.duration;
      },
      mark: () => ({
        firstVoiced,
        lastVoiced,
        ended,
        pending: active.size,
        gaps,
        discarded,
      }),
      interrupt() {
        // Future scheduled voiced samples are discarded by stop().
        if (lastVoiced !== null) lastVoiced = Math.min(lastVoiced, clock());
        discarded += active.size;
        for (const node of active) node.stop();
        end = 0;
      },
    };
  });
  if (microphone)
    await page.locator("#mic").evaluate((b) => b.removeAttribute("hidden"));
  return page;
}
