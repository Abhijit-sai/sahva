const el = (id) => document.getElementById(id);
const catalog = await fetch("/catalog").then((r) => r.json());
const label = (code) => catalog.languages[code];
const engines = catalog.engines;
const cfg = (id) => engines.find((e) => e.id === id);
const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
let active,
  context,
  previousMic,
  playing = [],
  batch = false,
  cancelled = false;
const results = [];
const urls = [];
const makeUrl = (blob) => {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
};
function choices(id, items, value) {
  el(id).replaceChildren(
    ...items.map(([v, name, disabled]) => {
      const o = new Option(name, v);
      o.disabled = !!disabled;
      return o;
    }),
  );
  if (value != null) el(id).value = value;
}
const source = () => el("direction").value,
  target = () => el("language").value;
function supported() {
  return engines.filter(
    (e) =>
      source() !== target() &&
      e.sources.includes(source()) &&
      e.targets.includes(target()),
  );
}
function controls(resetFile = false) {
  const list = supported(),
    old = el("engine").value;
  choices(
    "engine",
    list.map((e) => [e.id, e.name, !!e.issue]),
    list.some((e) => e.id === old && !e.issue)
      ? old
      : list.find((e) => !e.issue)?.id,
  );
  const model = cfg(el("engine").value);
  const access = list
    .filter((e) => e.issue)
    .map((e) => e.name + " · " + e.issue);
  if (model && !model.issue)
    access.unshift(
      model.model +
        " · " +
        (catalog.verified.includes([model.id, source(), target()].join("/"))
          ? "Recorded speech verified for this direction"
          : "Configured · access tested when you start"),
    );
  el("access").textContent = list.length
    ? access.join("  ")
    : "Choose two different supported languages.";
  const input = resetFile ? "mic" : el("input").value || "mic";
  const files = [
    ["mic", "Live microphone"],
    ["upload", "Upload audio"],
    ...(previousMic?.source === source()
      ? [["previous", "Last microphone recording"]]
      : []),
    ...catalog.fixtures
      .filter((f) => f.source === source())
      .map((f) => [f.id, f.name]),
  ];
  choices("input", files, files.some(([v]) => v === input) ? input : "mic");
  el("targetLabel").textContent = "Translation · " + label(target());
  el("uploadLabel").hidden = el("input").value !== "upload";
  el("script").textContent =
    catalog.fixtures.find((f) => f.id === el("input").value)?.reference ?? "";
  el("choices").replaceChildren();
  for (const e of list.filter((e) => !e.issue)) {
    const l = document.createElement("label"),
      c = document.createElement("input");
    c.type = "checkbox";
    c.value = e.id;
    c.checked = true;
    l.append(c, " " + e.name);
    el("choices").append(l);
  }
  el("choices").hidden = el("compare").hidden = el("input").value === "mic";
  el("compare").disabled = !list.some((e) => !e.issue);
  el("start").disabled = !model || !!model.issue;
}
choices("direction", Object.entries(catalog.languages), "te");
choices("language", Object.entries(catalog.languages), "en");
function selectionChanged(resetFile = false) {
  controls(resetFile);
  stopSound();
  el("source").textContent = el("target").textContent = "";
  el("sourceLabel").textContent = "Source transcript";
  el("languageNotice").hidden = true;
  el("latency").textContent = el("endLatency").textContent = "—";
  el("replay").disabled = true;
  el("status").textContent = "Ready";
}
el("direction").onchange = () => selectionChanged(true);
el("language").onchange = () => selectionChanged();
el("engine").onchange = () => selectionChanged();
el("input").onchange = () => selectionChanged();
controls();
el("status").textContent = "Ready";
function lock(b) {
  for (const id of [
    "direction",
    "language",
    "engine",
    "input",
    "upload",
    "start",
    "compare",
  ])
    el(id).disabled = b;
  for (const box of el("choices").querySelectorAll("input")) box.disabled = b;
  el("cancel").hidden = !b;
  if (!b) controls();
}
function join(parts) {
  const a = new Int16Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    a.set(p, i);
    i += p.length;
  }
  return a;
}
function wav(pcm, rate) {
  const header = new ArrayBuffer(44),
    v = new DataView(header);
  const tag = (offset, s) =>
    [...s].forEach((c, i) => v.setUint8(offset + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  return new Blob([header, pcm], { type: "audio/wav" });
}
async function recording() {
  const id = el("input").value;
  if (id === "mic") return null;
  if (id === "previous") return previousMic.pcm;
  const file =
    id === "upload"
      ? el("upload").files[0]
      : await fetch("/fixture/" + id).then((r) => {
          if (!r.ok) throw Error("Saved recording unavailable");
          return r.blob();
        });
  if (!file || file.size > 4000000)
    throw Error("Choose an audio file under 4 MB.");
  const bytes = await file.arrayBuffer();
  // Standard PCM WAV fixtures are forwarded exactly, including all original pauses.
  const v = new DataView(bytes);
  if (
    bytes.byteLength >= 44 &&
    v.getUint32(0) === 0x52494646 &&
    v.getUint32(8) === 0x57415645 &&
    v.getUint32(12) === 0x666d7420 &&
    v.getUint16(20, true) === 1 &&
    v.getUint16(22, true) === 1 &&
    v.getUint32(24, true) === 16000 &&
    v.getUint16(34, true) === 16 &&
    v.getUint32(36) === 0x64617461 &&
    v.getUint32(40, true) === bytes.byteLength - 44
  ) {
    if (
      bytes.byteLength > 832044 ||
      bytes.byteLength <= 44 ||
      (bytes.byteLength - 44) % 2
    )
      throw Error("Use up to 26 seconds of mono audio.");
    return new Int16Array(bytes, 44);
  }
  const offline = new OfflineAudioContext(1, 1, 16000);
  const decoded = await offline.decodeAudioData(bytes);
  if (decoded.length > 416000 || decoded.length < 1)
    throw Error("Choose a recording up to 26 seconds.");
  const pcm = new Int16Array(decoded.length);
  for (let i = 0; i < pcm.length; i++) {
    let sum = 0;
    for (let c = 0; c < decoded.numberOfChannels; c++)
      sum += decoded.getChannelData(c)[i];
    pcm[i] = Math.round(
      Math.min(1, Math.max(-1, sum / decoded.numberOfChannels)) * 32767,
    );
  }
  return pcm;
}
function bounds(pcm, rate) {
  let first = null,
    last = null;
  const w = Math.max(1, Math.round(rate / 100));
  for (let i = 0; i < pcm.length; i += w) {
    const end = Math.min(i + w, pcm.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += pcm[j] ** 2;
    if (sum / (end - i) > 180 ** 2) {
      first ??= (1000 * i) / rate;
      last = (1000 * end) / rate;
    }
  }
  return { first, last };
}
function stopSound() {
  for (const n of playing) n.stop();
  playing = [];
}
function release(s) {
  clearTimeout(s.timer);
  s.mic?.getTracks().forEach((t) => t.stop());
  if (s.node) {
    s.node.port.onmessage = null;
    s.node.disconnect();
  }
  if (s.capture && s.capture.state !== "closed")
    void s.capture.close().catch(() => {});
  s.capture = null;
}
function schedule(s, pcm, rate) {
  const audio = context.createBuffer(1, pcm.length, rate),
    data = audio.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 32768;
  const node = context.createBufferSource();
  node.buffer = audio;
  node.connect(context.destination);
  const at = Math.max(context.currentTime + 0.015, s.next || 0),
    now = performance.now(),
    scheduled = now + (at - context.currentTime) * 1000;
  node.start(at);
  playing.push(node);
  node.onended = () => {
    node.disconnect();
    playing = playing.filter((n) => n !== node);
  };
  s.next = at + audio.duration;
  const b = bounds(pcm, rate);
  if (b.first != null) {
    s.firstReceipt ??= now;
    s.firstPlay ??= scheduled + b.first;
    s.lastPlay = scheduled + b.last;
    if (s.onset != null)
      el("latency").textContent =
        ((s.firstPlay - s.onset) / 1000).toFixed(2) + " s";
  }
  s.outputs.push({ pcm, rate });
}
function cls(s, error) {
  if (s.ended) return;
  s.ended = true;
  release(s);
  el("finish").hidden = true;
  if (s.ws?.readyState < 2) s.ws.close();
  if (error) stopSound();
  s.error = error || null;
  s.resolve();
}
function sendFrame(s, pcm, time) {
  if (s.ended) return;
  if (s.ws.bufferedAmount > 128000) throw Error("Input backed up");
  const b = bounds(pcm, 16000);
  if (b.first != null) {
    s.onset ??= time + b.first;
    s.endSource = time + b.last;
  }
  s.inputs.push(pcm);
  s.ws.send(pcm);
}
async function feedFile(s, file) {
  const start = performance.now();
  for (let i = 0; i < file.length; i += 1600) {
    await delay(start + i / 16 - performance.now());
    if (s.ended) return;
    sendFrame(s, file.subarray(i, i + 1600), start + i / 16);
  }
  await delay(start + file.length / 16 - performance.now());
  if (!s.ended) s.ws.send("finish");
}
function finishMic() {
  const s = active;
  if (!s?.node || s.finishing || s.ended) return;
  s.finishing = true;
  el("finish").hidden = true;
  s.node.port.postMessage("finish");
  s.mic.getTracks().forEach((t) => t.stop());
  clearTimeout(s.timer);
  s.timer = setTimeout(() => cls(s, "Final microphone packet timed out"), 2000);
  el("status").textContent = "Finishing translation…";
}
async function run(id, file, anotherTrialFollows) {
  const e = cfg(id),
    s = {
      model: e.model,
      id,
      from: source(),
      to: target(),
      inputs: [],
      outputs: [],
      text: { source: "", target: "" },
      languages: new Set(),
    };
  active = s;
  el("source").textContent = el("target").textContent = "";
  el("sourceLabel").textContent = "Source transcript";
  el("languageNotice").hidden = true;
  el("latency").textContent = el("endLatency").textContent = "—";
  el("status").textContent = "Connecting to " + e.name + "…";
  const done = new Promise((resolve) => (s.resolve = resolve));
  try {
    if (!file) {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (s.ended) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      s.mic = mic;
      s.capture = new AudioContext({ sampleRate: 16000 });
      await s.capture.resume();
      await s.capture.audioWorklet.addModule("/demo-pcm.js");
      if (s.ended) return;
      s.node = new AudioWorkletNode(s.capture, "demo-pcm");
    }
    const ws = new WebSocket(
      "ws://" + location.host + "/listen/" + [id, s.from, s.to].join("/"),
    );
    s.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onerror = () =>
      cls(
        s,
        "Connection failed. Check provider setup and close any other trial.",
      );
    let queue = Promise.resolve();
    ws.onclose = () => {
      void queue.then(() => cls(s, "Session closed before completion"));
    };
    ws.onmessage = (event) => {
      queue = queue
        .then(async () => {
          if (s.ended) return;
          if (typeof event.data !== "string") {
            schedule(s, new Int16Array(event.data), 24000);
            return;
          }
          const m = JSON.parse(event.data);
          if (m.type === "ready") {
            if (file) {
              el("status").textContent = "Replaying recording · " + e.name;
              void feedFile(s, file).catch((err) => cls(s, err.message));
            } else {
              s.node.port.onmessage = ({ data }) => {
                if (s.ended) return;
                try {
                  if (data === "finished") {
                    release(s);
                    ws.send("finish");
                    return;
                  }
                  const p = new Int16Array(data);
                  sendFrame(s, p, performance.now() - p.length / 16);
                } catch (err) {
                  cls(s, err.message);
                }
              };
              s.capture.createMediaStreamSource(s.mic).connect(s.node);
              s.node.connect(s.capture.destination);
              el("finish").hidden = false;
              el("status").textContent = "Listening · speak now";
              s.timer = setTimeout(finishMic, 25000);
            }
          } else if (m.type === "caption") {
            if (m.side === "source" && m.text) {
              s.firstTranscript ??= performance.now();
              if (m.final) s.firstCommitted ??= performance.now();
            }
            if (m.side === "target") s.firstText ??= performance.now();
            s.text[m.side] = m.replace ? m.text : s.text[m.side] + m.text;
            el(m.side).textContent = s.text[m.side];
            if (m.side === "source" && m.languageCode) {
              const code = m.languageCode.split("-")[0];
              s.languages.add(
                label(code) ||
                  new Intl.DisplayNames(["en"], { type: "language" }).of(code),
              );
              el("sourceLabel").textContent =
                "Source transcript · reported " + [...s.languages].join(", ");
              if (code !== s.from && code !== s.to) {
                el("languageNotice").hidden = false;
                el("languageNotice").textContent =
                  "Check the source language. The provider reported " +
                  code +
                  ".";
              }
            }
          } else if (m.type === "wav") {
            const b = Uint8Array.from(atob(m.data), (c) => c.charCodeAt(0));
            const decoded = await context.decodeAudioData(b.buffer);
            schedule(
              s,
              Int16Array.from(decoded.getChannelData(0), (v) =>
                Math.round(v * 32767),
              ),
              decoded.sampleRate,
            );
          } else if (m.type === "interrupt") {
            s.interrupted = true;
            stopSound();
            s.next = 0;
          } else if (m.type === "error") cls(s, m.message);
          else if (m.type === "done")
            cls(s, m.voiced ? null : "No voiced translation received");
        })
        .catch((err) => cls(s, err.message));
    };
    await done;
  } catch (err) {
    cls(s, err.message);
  }
  if (!s.ended) return;
  const input = join(s.inputs);
  if (!file && input.length) previousMic = { pcm: input, source: s.from };
  const diff = (a, b) => (a == null || b == null ? null : Math.round(a - b));
  const metrics = {
    speechDuration: diff(s.endSource, s.onset),
    firstTranscript: diff(s.firstTranscript, s.onset),
    firstCommitted: diff(s.firstCommitted, s.onset),
    firstTranslatedText: diff(s.firstText, s.onset),
    firstVoicedReceipt: diff(s.firstReceipt, s.onset),
    firstVoicedPlayback: diff(s.firstPlay, s.onset),
    endToFirstPlayback: diff(s.firstPlay, s.endSource),
    endToLastPlayback: s.interrupted ? null : diff(s.lastPlay, s.endSource),
    firstPlaybackMinusReceipt: diff(s.firstPlay, s.firstReceipt),
    onsetToCompletePlayback: s.interrupted ? null : diff(s.lastPlay, s.onset),
  };
  const display = (v) => (v == null ? "—" : (v / 1000).toFixed(2) + " s");
  el("latency").textContent = display(metrics.firstVoicedPlayback);
  el("endLatency").textContent = display(metrics.endToLastPlayback);
  const hash = await sha256(input);
  const translatedWav = s.outputs.length
    ? wav(join(s.outputs.map((o) => o.pcm)), s.outputs[0].rate)
    : null;
  const result = {
    engine: id,
    model: e.model,
    voice: e.voice,
    source: s.from,
    target: s.to,
    capturedAt: new Date().toISOString(),
    sha256: hash,
    translatedWavSha256: translatedWav
      ? await sha256(await translatedWav.arrayBuffer())
      : null,
    sentSamples: input.length,
    configuration: {
      inputHz: 16000,
      providerInputHz: id === "openai" ? 24000 : 16000,
      inputPaddingMs: 0,
      sourceHint: id === "gemini",
      targetEcho: id === "gemini",
      reportingPeriods: id === "gemini" && s.from === "en" && s.to === "te",
    },
    transcripts: s.text,
    metrics,
    error: s.error,
    review: {},
  };
  results.push(result);
  const original = input.length ? makeUrl(wav(input, 16000)) : null,
    translated = translatedWav ? makeUrl(translatedWav) : null;
  showResult(result, original, translated);
  if (translated) {
    el("replay").disabled = false;
    el("replay").onclick = () => {
      if (batch) return;
      stopSound();
      void [
        ...document.querySelectorAll("#results article:first-of-type audio"),
      ]
        .at(-1)
        ?.play();
    };
  }
  if (!s.error) catalog.verified.push([id, s.from, s.to].join("/"));
  el("status").textContent = s.error || "Trial complete";
  if (anotherTrialFollows && !s.error && s.next)
    await delay(Math.max(0, (s.next - context.currentTime) * 1000));
}
async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
const metricNames = {
  firstTranscript: "First source caption from onset",
  firstCommitted: "First final source caption from onset",
  speechDuration: "Source speech span",
  firstTranslatedText: "First translated text from onset",
  firstVoicedReceipt: "First voiced chunk received from onset",
  firstVoicedPlayback: "First voiced playback from onset",
  endToFirstPlayback: "End of source to first voiced playback",
  endToLastPlayback: "End of source to last voiced playback",
  firstPlaybackMinusReceipt: "First voice scheduling and leading quiet",
  onsetToCompletePlayback: "Source onset to last voiced playback",
};
function element(tag, text) {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
}
function showResult(r, original, translated) {
  const match = results.filter(
    (v) =>
      v.sha256 === r.sha256 && v.source === r.source && v.target === r.target,
  );
  const summary = document.createElement("table");
  function compareRow(title, values) {
    const row = document.createElement("tr");
    row.append(element("th", title), ...values.map((v) => element("td", v)));
    summary.append(row);
  }
  compareRow(
    "Same recording",
    match.map((v) => cfg(v.engine).name),
  );
  compareRow(
    "Translated text",
    match.map((v) => v.transcripts.target || "Unavailable"),
  );
  for (const k of ["firstVoicedPlayback", "endToLastPlayback"])
    compareRow(
      metricNames[k],
      match.map((v) =>
        v.metrics[k] == null ? "—" : (v.metrics[k] / 1000).toFixed(2) + " s",
      ),
    );
  compareRow(
    "Trial status",
    match.map((v) => v.error || "Received translated speech"),
  );
  el("comparison").replaceChildren(summary);
  el("history").hidden = false;
  const a = document.createElement("article");
  a.append(
    element(
      "h3",
      cfg(r.engine).name + " · " + label(r.source) + " → " + label(r.target),
    ),
    element("p", r.model + " · source " + r.sha256.slice(0, 12)),
  );
  if (r.error) a.append(element("p", r.error));
  a.append(
    element("p", "Source: " + (r.transcripts.source || "Unavailable")),
    element("p", "Translation: " + (r.transcripts.target || "Unavailable")),
  );
  for (const [title, url] of [
    ["Original", original],
    ["Translation", translated],
  ]) {
    if (!url) continue;
    const l = element("label", title),
      audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    l.append(audio);
    a.append(l);
  }
  const table = document.createElement("table");
  for (const [k, v] of Object.entries(r.metrics)) {
    const tr = document.createElement("tr");
    tr.append(
      element("th", metricNames[k]),
      element("td", v == null ? "—" : (v / 1000).toFixed(2) + " s"),
    );
    table.append(tr);
  }
  a.append(table);
  const d = document.createElement("details");
  d.append(element("summary", "Fluent reviewer ratings"));
  for (const key of [
    "Meaning",
    "Names",
    "Numbers and units",
    "Negations",
    "Completeness",
    "Expressiveness",
    "Comprehension",
  ]) {
    const l = element("label", key),
      sel = document.createElement("select");
    sel.add(new Option("Unrated", ""));
    for (let i = 1; i <= 5; i++) sel.add(new Option(i + " / 5", String(i)));
    sel.onchange = () => {
      r.review[key] = sel.value ? Number(sel.value) : null;
    };
    l.append(sel);
    d.append(l);
  }
  const note = element("label", "Corrections or omissions"),
    area = document.createElement("textarea");
  area.oninput = () => (r.review.notes = area.value);
  note.append(area);
  d.append(note);
  a.append(d);
  el("results").prepend(a);
}
async function start(compare) {
  if (active || batch) return;
  const ids = compare
    ? [...el("choices").querySelectorAll("input:checked")].map((n) => n.value)
    : [el("engine").value];
  if (!ids.length) {
    el("status").textContent = "Choose at least one provider.";
    return;
  }
  batch = true;
  cancelled = false;
  lock(true);
  el("replay").disabled = true;
  stopSound();
  document.querySelectorAll("audio").forEach((a) => a.pause());
  try {
    context ??= new AudioContext({ sampleRate: 24000 });
    await context.resume();
    const pcm = await recording();
    for (const [index, id] of ids.entries()) {
      if (cancelled) break;
      await run(id, pcm, index + 1 < ids.length);
      active = null;
    }
  } catch (err) {
    el("status").textContent = err.message;
  } finally {
    active = null;
    batch = false;
    lock(false);
  }
}
el("start").onclick = () => start(false);
el("compare").onclick = () => start(true);
el("finish").onclick = finishMic;
el("cancel").onclick = () => {
  cancelled = true;
  if (active) cls(active, "Trial cancelled");
  stopSound();
};
el("download").onclick = () => {
  const a = document.createElement("a");
  a.href = makeUrl(
    new Blob([JSON.stringify(results, null, 2)], { type: "application/json" }),
  );
  a.download = "sahva-translation-review.json";
  a.click();
};
window.addEventListener("pagehide", () => {
  cancelled = true;
  if (active) cls(active, "Closed");
  stopSound();
  urls.forEach((u) => URL.revokeObjectURL(u));
});
document.addEventListener(
  "play",
  (event) => {
    if (event.target instanceof HTMLAudioElement) {
      if (batch) {
        event.target.pause();
        return;
      }
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== event.target) a.pause();
      });
    }
  },
  true,
);
