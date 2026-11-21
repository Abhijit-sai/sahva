import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import {
  candidates,
  languages,
  eligible,
  setupIssue,
  type Engine,
  type Lang,
} from "./catalog.ts";
import { startEngine } from "./lab-engine.ts";
import { voicedBounds, loadRecording, wav } from "./audio.ts";

const port = 19752,
  host = "127.0.0.1:" + port;
const assets = new Map([
  ["/", ["demo.html", "text/html"]],
  ["/demo.js", ["demo.js", "text/javascript"]],
  ["/demo-pcm.js", ["demo-pcm.js", "text/javascript"]],
]);
const fixtures = new Map<
  string,
  { path: string; source: string; name: string; reference: string }
>();
const verified = new Set<string>();
const entries = await readdir(".sahva").catch(() => [] as string[]);
for (const dir of entries) {
  if (/^model-lab-[\w-]+$/.test(dir)) {
    try {
      const r = JSON.parse(
        await readFile(join(".sahva", dir, "result.json"), "utf8"),
      );
      if (
        Object.hasOwn(candidates, r.engine) &&
        candidates[r.engine as Engine].model === r.model &&
        Number.isFinite(r.measures?.firstVoicedReceiptMs)
      )
        verified.add([r.engine, r.source, r.target].join("/"));
    } catch {
      /* Incomplete trial. */
    }
  }
  if (!/^s2st-fixtures-[\w-]+$/.test(dir)) continue;
  for (const scenario of ["corrections", "business", "switch", "pause"]) {
    const root = join(".sahva", dir, scenario);
    try {
      const ref = JSON.parse(
        await readFile(join(root, "reference.json"), "utf8"),
      );
      for (const [source, file] of [
        ["te", "telugu.wav"],
        ["en", "english.wav"],
      ]) {
        fixtures.set(source + "-" + scenario, {
          path: join(root, file),
          source,
          name: scenario + " · synthetic",
          reference: ref[source].join(" "),
        });
      }
    } catch {
      /* Scenario has not been generated here. */
    }
  }
}
for (const [id, folder, file, source] of [
  ["quarter-previous", "quarter-ab-yplmsT", "previous", "en"],
  ["quarter-current", "quarter-ab-yplmsT", "current", "en"],
  ["hi-corrections", "lab-hindi", "corrections", "hi"],
]) {
  try {
    const root = join(".sahva", folder);
    const { script } = JSON.parse(
      await readFile(join(root, file + ".json"), "utf8"),
    );
    fixtures.set(id, {
      path: join(root, file + ".wav"),
      source,
      name: id + " · synthetic",
      reference: script,
    });
  } catch {
    /* Optional saved fixture. */
  }
}
const server = createServer(async (req, res) => {
  if (req.headers.host !== host || req.method !== "GET") {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "microphone=(self), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self' ws://" +
      host +
      "; media-src 'self' blob:; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  );
  try {
    if (req.url === "/catalog") {
      const engines = Object.entries(candidates).map(([id, c]) => ({
        id,
        name: c.name,
        model: c.model,
        mode: c.mode,
        voice: c.voice,
        sources: c.sources,
        targets: c.targets,
        issue: setupIssue(id as Engine),
      }));
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            engines,
            languages,
            verified: [...verified],
            fixtures: [...fixtures].map(([id, f]) => ({
              id,
              name: f.name,
              source: f.source,
              reference: f.reference,
            })),
          }),
        );
      return;
    }
    const fixture = fixtures.get(
      req.url?.startsWith("/fixture/") ? req.url.slice(9) : "",
    );
    if (fixture) {
      res
        .writeHead(200, { "Content-Type": "audio/wav" })
        .end(wav(await loadRecording(fixture.path), 16000));
      return;
    }
    const asset = assets.get(req.url ?? "");
    if (!asset) {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, { "Content-Type": asset[1] + "; charset=utf-8" })
      .end(await readFile(join("scripts/s2st", asset[0])));
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
});
const sessions = new WebSocketServer({
  noServer: true,
  maxPayload: 6400,
  perMessageDeflate: false,
});
server.on("upgrade", (req, socket, head) => {
  const path = (req.url ?? "").split("/");
  const [, action, engine, source, target] = path as [
    string,
    string,
    Engine,
    Lang,
    Lang,
  ];
  if (
    path.length !== 5 ||
    action !== "listen" ||
    !Object.hasOwn(candidates, engine) ||
    !eligible(engine, source, target) ||
    setupIssue(engine) ||
    req.headers.host !== host ||
    req.headers.origin !== "http://" + host ||
    sessions.clients.size
  ) {
    socket.destroy();
    return;
  }
  sessions.handleUpgrade(req, socket, head, (peer) => {
    void interpret(peer, engine, source, target);
  });
});
async function interpret(
  peer: WebSocket,
  engine: Engine,
  source: Lang,
  target: Lang,
) {
  let provider: Awaited<ReturnType<typeof startEngine>> | undefined;
  let bytes = 0,
    voiced = false,
    finishing = false,
    ending = 0,
    activity = 0;
  const opened = Date.now();
  const send = (item: object) => {
    if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify(item));
  };
  const stop = (message: string) => {
    send({ type: "error", message });
    peer.close();
    provider?.close();
  };
  const complete = () => {
    if (voiced) verified.add([engine, source, target].join("/"));
    send({ type: "done", voiced });
    peer.close();
    provider?.close();
  };
  const timer = setInterval(() => {
    try {
      provider?.check();
      if (
        ending &&
        ((voiced && Date.now() - Math.max(ending, activity) > 4500) ||
          Date.now() - ending > 15000)
      )
        complete();
      else if (Date.now() - opened > 85000 || peer.bufferedAmount > 2000000)
        stop("Trial exceeded its time or playback buffer limit.");
    } catch (e) {
      stop(e instanceof Error ? e.message : "Provider disconnected");
    }
  }, 150);
  peer.on("error", () => peer.terminate());
  peer.once("close", () => {
    clearInterval(timer);
    provider?.close();
  });
  try {
    provider = await startEngine(engine, source, target, {
      audio(b, format) {
        if (peer.readyState !== WebSocket.OPEN) return;
        if (format === "wav" || voicedBounds(b, 24000).first !== null) {
          voiced = true;
          activity = Date.now();
        }
        if (format === "wav") send({ type: "wav", data: b.toString("base64") });
        else peer.send(b);
      },
      text(side, text, final, languageCode) {
        if (text) {
          activity = Date.now();
          send({
            type: "caption",
            side,
            text,
            final,
            languageCode,
            replace: engine === "sarvam",
          });
        }
      },
      event(name) {
        if (name === "interrupted") send({ type: "interrupt" });
      },
      usage() {},
    });
    if (peer.readyState !== WebSocket.OPEN) {
      provider.close();
      return;
    }
    let queue = Promise.resolve();
    peer.on("message", (raw, binary) => {
      if (finishing || peer.readyState !== WebSocket.OPEN) return;
      if (!binary && raw.toString() === "finish") {
        finishing = true;
        queue = queue.then(async () => {
          if (peer.readyState !== WebSocket.OPEN) return;
          await provider!.finish();
          if (engine === "gemini") ending = Date.now();
          else complete();
        });
      } else if (
        binary &&
        Buffer.isBuffer(raw) &&
        raw.length > 0 &&
        raw.length <= 3200 &&
        raw.length % 2 === 0 &&
        bytes + raw.length <= 832000
      ) {
        bytes += raw.length;
        queue = queue.then(async () => {
          if (peer.readyState === WebSocket.OPEN) await provider!.feed(raw);
        });
      } else {
        stop("Invalid or oversized microphone stream.");
        return;
      }
      queue = queue.catch((e) =>
        stop(e instanceof Error ? e.message : "Streaming failed"),
      );
    });
    send({ type: "ready", model: candidates[engine].model });
  } catch (e) {
    stop(e instanceof Error ? e.message : "Provider setup failed");
  }
}
server.listen(port, "127.0.0.1", () =>
  console.log("Sahva translation demo at http://" + host),
);
