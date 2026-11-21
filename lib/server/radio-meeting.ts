import { gemini } from "../providers/gemini-interpretation.ts";
import type { Language } from "../shared.ts";
import type { openPcmTrack } from "./interpretation-output.ts";

type Channel = Awaited<ReturnType<typeof openPcmTrack>>;
type Publish = (
  room: string,
  name: string,
  publisher: string,
  stop: AbortSignal,
) => Promise<Channel>;
type Listener = {
  member: string;
  target: Language;
  room: string;
  stop: AbortSignal;
};
type Source = {
  member: string;
  language: Language;
  sid: string;
  routes: Map<Language, Route>;
  clip?: Clip;
};
import { geminiCode } from "../meeting-languages.ts";
import type { MeetingArchive, Clip } from "./meeting-archive.ts";

// A 20 ms output block at 24 kHz. Each route owns its envelope and PCM queues.
function hasVoice(translation?: Int16Array) {
  let power = 0;
  for (const sample of translation ?? []) power += sample * sample;
  return power > 480 * 120 ** 2;
}
export class RadioMix {
  private gain = 1;
  private hold = 0;
  render(original?: Int16Array, translation?: Int16Array) {
    const out = new Int16Array(480);
    if (hasVoice(translation)) this.hold = 6;
    const target = this.hold > 0 ? 0.1 : 1;
    this.hold = Math.max(0, this.hold - 1);
    const step =
      1 - Math.exp(-1 / (24000 * (target < this.gain ? 0.012 : 0.09)));
    for (let i = 0; i < out.length; i++) {
      this.gain += step * (target - this.gain);
      const pos = (i * 2) / 3;
      const index = Math.floor(pos);
      const a = original?.[index] ?? 0;
      const b = original?.[index + 1] ?? a;
      const mixed =
        (a + (b - a) * (pos - index)) * this.gain + (translation?.[i] ?? 0);
      out[i] = Math.max(-32768, Math.min(32767, Math.round(mixed)));
    }
    return out;
  }
}

type Sink = {
  room: string;
  clip?: Clip;
  caption: string;
  channel?: Channel;
  writing: Promise<void>;
  pending: number;
  stop: AbortController;
};
type Route = {
  sinks: Map<string, Sink>;
  stop: AbortController;
  session?: Awaited<ReturnType<typeof gemini>>;
  originals: Int16Array[];
  pendingInput: Buffer[];
  translated: Buffer;
  mix: RadioMix;
  originalText: string;
  translatedText: string;
  inputFinal: boolean;
  outputFinal: boolean;
  failed: boolean;
  starting: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export class RadioMeeting {
  private sources = new Map<string, Source>();
  private listeners = new Map<string, Listener>();
  private publish: Publish;
  private issues: Map<string, string>;
  private translate: typeof gemini;
  private archive?: Pick<MeetingArchive, "original" | "replay">;
  constructor(
    publish: Publish,
    issues: Map<string, string>,
    translate = gemini,
    archive?: Pick<MeetingArchive, "original" | "replay">,
  ) {
    this.publish = publish;
    this.issues = issues;
    this.translate = translate;
    this.archive = archive;
  }

  listen(member: string, target: Language, room: string, stop: AbortSignal) {
    if (stop.aborted) return;
    const listener = { member, target, room, stop };
    this.listeners.set(member, listener);
    for (const source of this.sources.values()) this.attach(source, listener);
    stop.addEventListener(
      "abort",
      () => {
        if (this.listeners.get(member) === listener)
          this.listeners.delete(member);
        for (const source of this.sources.values()) {
          const route = source.routes.get(target);
          const sink = route?.sinks.get(member);
          if (!route || sink?.room !== room) continue;
          this.detach(source, target, route, member, sink);
        }
      },
      { once: true },
    );
  }

  source(member: string, language: Language, sid: string, stop: AbortSignal) {
    const source: Source = { member, language, sid, routes: new Map() };
    stop.throwIfAborted();
    source.clip = this.archive?.original(member, language, sid);
    this.sources.set(member, source);
    for (const listener of this.listeners.values())
      this.attach(source, listener);
    stop.addEventListener(
      "abort",
      () => {
        source.clip?.close();
        if (this.sources.get(member) === source) this.sources.delete(member);
        for (const [target, route] of source.routes)
          this.remove(source, target, route);
      },
      { once: true },
    );
    return (frame: Int16Array) => {
      if (stop.aborted) return;
      const pcm = Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength);
      source.clip?.frame(pcm);
      for (const route of source.routes.values()) {
        if (route.originals.length >= 10) {
          route.originals.shift();
          this.warn(route, "Original audio is catching up.");
        }
        route.originals.push(frame);
        if (route.failed) continue;
        if (!route.session) {
          if (route.pendingInput.length >= 150) {
            route.pendingInput.shift();
            this.warn(
              route,
              "Interpretation started late. Review earlier speech in the timeline.",
            );
          }
          route.pendingInput.push(pcm);
        } else {
          try {
            route.session.check();
            route.session.feed(pcm);
          } catch {
            this.fail(route);
          }
        }
      }
    };
  }

  pendingWrites() {
    return Promise.allSettled(
      [...this.sources.values()].flatMap((source) =>
        [...source.routes.values()].flatMap((route) =>
          [...route.sinks.values()].map((sink) => sink.writing),
        ),
      ),
    );
  }
  captions(member: string) {
    const target = this.listeners.get(member)?.target;
    if (!target) return [];
    return Array.from(this.sources.values()).flatMap((source) => {
      const route = source.routes.get(target);
      return route?.sinks.has(member) &&
        (route.originalText || route.translatedText)
        ? [
            {
              speaker: source.member,
              source: source.language,
              target,
              original: route.originalText,
              translation: route.translatedText,
            },
          ]
        : [];
    });
  }

  private warn(route: Route, message: string) {
    for (const member of route.sinks.keys()) this.issues.set(member, message);
  }
  private fail(route: Route) {
    if (route.failed || route.stop.signal.aborted) return;
    route.failed = true;
    route.session?.close();
    route.session = undefined;
    route.pendingInput = [];
    route.translated = Buffer.alloc(0);
    this.warn(
      route,
      "Interpretation or captions interrupted. Original audio continues. Rejoin meeting audio to retry.",
    );
  }
  private remove(source: Source, target: Language, route: Route) {
    clearTimeout(route.timer);
    route.stop.abort();
    route.session?.close();
    for (const sink of route.sinks.values()) sink.stop.abort();
    source.routes.delete(target);
  }
  private detach(
    source: Source,
    target: Language,
    route: Route,
    member: string,
    sink: Sink,
  ) {
    sink.stop.abort();
    if (route.sinks.get(member) !== sink) return;
    route.sinks.delete(member);
    if (!route.sinks.size && source.routes.get(target) === route)
      this.remove(source, target, route);
  }
  private attach(source: Source, listener: Listener) {
    if (source.member === listener.member) return;
    const target = listener.target;
    let route = source.routes.get(target);
    if (!route) {
      const created: Route = {
        sinks: new Map(),
        stop: new AbortController(),
        originals: [],
        pendingInput: [],
        translated: Buffer.alloc(0),
        mix: new RadioMix(),
        originalText: "",
        translatedText: "",
        inputFinal: false,
        outputFinal: false,
        failed: false,
        starting: false,
      };
      source.routes.set(target, created);
      route = created;
      let next = performance.now() + 20;
      const render = () => {
        if (created.stop.signal.aborted) return;
        this.play(source, target, created);
        next = Math.max(performance.now() + 1, next + 20);
        created.timer = setTimeout(render, next - performance.now());
      };
      created.timer = setTimeout(render, 20);
    }
    const sink: Sink = {
      room: listener.room,
      caption: "",
      clip:
        source.language !== target
          ? this.archive?.replay(
              source.member,
              listener.member,
              target,
              source.sid,
            )
          : undefined,
      stop: new AbortController(),
      writing: Promise.resolve(),
      pending: 0,
    };
    sink.stop.signal.addEventListener(
      "abort",
      () => {
        void sink.writing.finally(() => sink.clip?.close());
      },
      { once: true },
    );
    route.sinks.set(listener.member, sink);
    const publisher = "radio-" + source.sid;
    const name = ["radio", target, source.member, source.sid].join("/");
    void this.publish(listener.room, name, publisher, sink.stop.signal)
      .then((channel) => {
        if (sink.stop.signal.aborted) {
          void channel.close();
          return;
        }
        sink.channel = channel;
        sink.stop.signal.addEventListener(
          "abort",
          () => {
            void channel.close().catch(() => {});
          },
          { once: true },
        );
        if (!route.starting && (!route.session || route.failed)) {
          route.starting = true;
          route.failed = false;
          void this.start(source, target, route).finally(() => {
            route.starting = false;
          });
        }
      })
      .catch(() => {
        if (!sink.stop.signal.aborted)
          this.issues.set(
            listener.member,
            "Incoming audio could not connect. Rejoin meeting audio.",
          );
        this.detach(source, target, route, listener.member, sink);
      });
  }
  private async start(source: Source, target: Language, route: Route) {
    try {
      const session = await this.translate(
        geminiCode(source.language),
        geminiCode(target),
        {
          audio: (bytes) => {
            if (
              source.language === target ||
              route.failed ||
              route.stop.signal.aborted
            )
              return;
            if (route.translated.length + bytes.length > 24000 * 2 * 6) {
              this.fail(route);
              return;
            }
            route.translated = Buffer.concat([route.translated, bytes]);
          },
          text: (side, text, final) => {
            if (side === "source") {
              route.originalText = (
                (route.inputFinal ? "" : route.originalText) + text
              ).slice(-1600);
              route.inputFinal = !!final;
              if (
                [...source.routes.values()].find(
                  (r) => r.session && !r.failed,
                ) === route
              )
                source.clip?.transcript(text, !!final);
            } else {
              route.translatedText = (
                (route.outputFinal ? "" : route.translatedText) + text
              ).slice(-1600);
              route.outputFinal = !!final;
              for (const sink of route.sinks.values()) {
                if (sink.channel)
                  sink.caption = (sink.caption + text).slice(-8000);
              }
            }
          },
          event: (event) => {
            if (event === "interrupted") route.translated = Buffer.alloc(0);
          },
          usage() {},
        },
        {
          hintSourceLanguage: true,
          echoTargetLanguage: source.language !== target,
          conversation: true,
          continuous: true,
          signal: route.stop.signal,
        },
      );
      if (route.stop.signal.aborted || route.failed) {
        session.close();
        return;
      }
      route.session = session;
      for (const pcm of route.pendingInput) session.feed(pcm);
      route.pendingInput = [];
    } catch {
      this.fail(route);
    }
  }
  private play(source: Source, target: Language, route: Route) {
    try {
      route.session?.check();
    } catch {
      this.fail(route);
    }
    const original = route.originals.shift();
    const bytes = route.translated.subarray(0, 960);
    if (!bytes.length && !original) return;
    route.translated = route.translated.subarray(bytes.length);
    const translation = new Int16Array(Uint8Array.from(bytes).buffer);
    const frame = route.mix.render(original, translation);
    const voicedTranslation = hasVoice(translation);
    for (const [member, sink] of route.sinks) {
      if (!sink.channel || sink.stop.signal.aborted) continue;
      if (sink.pending >= 10) {
        sink.caption = "";
        this.issues.set(
          member,
          "Incoming audio is catching up. Missed speech is available in the timeline after processing.",
        );
        continue;
      }
      sink.pending++;
      const channel = sink.channel;
      const caption = bytes.length ? sink.caption : "";
      if (bytes.length) sink.caption = "";
      sink.writing = sink.writing
        .then(async () => {
          if (sink.stop.signal.aborted) return;
          await channel.write(frame);
          sink.clip?.frame(
            Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength),
            voicedTranslation,
          );
          if (caption) sink.clip?.transcript(caption, false);
        })
        .catch(() => {
          if (!sink.stop.signal.aborted)
            this.issues.set(
              member,
              "Incoming audio disconnected. Rejoin meeting audio.",
            );
          this.detach(source, target, route, member, sink);
        })
        .finally(() => {
          sink.pending--;
        });
    }
  }
}
