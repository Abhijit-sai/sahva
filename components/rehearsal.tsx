import { languages } from "../lib/shared";
import { distribution } from "../lib/rehearsal";
import type { TurnView } from "./turn-card";

export type PlaybackObservation = {
  started: number;
  uncertainty: number;
  ended?: number;
  interrupted?: boolean;
  decoded?: boolean;
};
export type ListenerObservations = {
  ready: Map<string, number>;
  caption: Map<number, number>;
  playback: Map<string, PlaybackObservation>;
};

export function Rehearsal({
  turns,
  observations,
}: {
  turns: TurnView[];
  observations: ListenerObservations;
}) {
  const samples = turns.filter(
    (t) => t.live_timing && t.revision === 0 && t.source !== t.target,
  );
  const rows = samples.map((t) => {
    const live = t.live_timing!;
    const capture = live.capture;
    const playback =
      observations.playback.get(t.id) ??
      observations.playback.get(t.phrase_id ?? "");
    const ready = observations.ready.get(t.id);
    const caption =
      live.interim === undefined
        ? undefined
        : observations.caption.get(live.interim);
    const elapsed = (end?: number | null, start = capture?.onset) =>
      end != null && start !== undefined && end >= start
        ? Math.round(end - start)
        : undefined;
    return {
      turn: t.seq,
      route: t.source
        ? languages[t.source] + " → " + languages[t.target]
        : "Pending source",
      metrics: {
        "Visible caption": elapsed(caption),
        "ASR interim": elapsed(live.interim),
        "Final text": elapsed(live.final ?? t.transcribed_at),
        Translation: elapsed(t.translated_at),
        "Generated WAV": elapsed(t.generated_at),
        "Receiver decoded voice": playback?.decoded
          ? elapsed(playback.started)
          : undefined,
        "Playback start": elapsed(playback?.started),
        "Speech end to playback": capture
          ? elapsed(playback?.started, capture.lastVoiced)
          : undefined,
        "Ready observed to playback":
          ready === undefined ? undefined : elapsed(playback?.started, ready),
        "Playback complete": playback?.interrupted
          ? undefined
          : elapsed(playback?.ended),
      },
      interrupted: playback?.interrupted,
      uncertainty:
        capture && playback
          ? capture.uncertainty + playback.uncertainty
          : undefined,
    };
  });
  return (
    <details>
      <summary>Rehearsal timings</summary>
      <p>
        Incoming live phrases on this device, in milliseconds from speech
        detection. Speech end uses the last voiced frame. Playback measures
        browser scheduling for archived audio and first decoded voice for live
        tracks. Record the listener’s audible result separately.
      </p>
      {rows.length === 0 && <p>Waiting for an incoming live phrase.</p>}
      {Array.from(new Set(rows.map((row) => row.route))).map((route) => {
        const group = rows.filter((row) => row.route === route);
        if (!group.length) return null;
        return (
          <div key={route}>
            <strong>{route}</strong>
            <table>
              <thead>
                <tr>
                  {["Measure", "n", "Median", "p95", "Worst"].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(group[0].metrics).map((label) => {
                  const values = group.flatMap(
                    (row) =>
                      row.metrics[label as keyof typeof row.metrics] ?? [],
                  );
                  const stats = distribution(values);
                  return (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{stats?.n ?? 0}</td>
                      <td>{stats?.median ?? "—"}</td>
                      <td>{stats?.p95 ?? "—"}</td>
                      <td>{stats?.worst ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {group.map((row) => (
              <details key={row.turn}>
                <summary>
                  Turn {row.turn}
                  {row.interrupted ? " · playback interrupted" : ""}
                </summary>
                <p>
                  {Object.entries(row.metrics)
                    .map(([label, value]) => label + " " + (value ?? "—"))
                    .join(" · ")}
                </p>
                <p>
                  Estimated combined clock uncertainty ±{row.uncertainty ?? "—"}{" "}
                  ms.
                </p>
              </details>
            ))}
          </div>
        );
      })}
    </details>
  );
}
