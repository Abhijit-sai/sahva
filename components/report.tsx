"use client";
import { useEffect, useReducer, useState } from "react";
import { api } from "./client";
import { languages, type Language } from "../lib/shared";
import type { Fact } from "../lib/providers/meeting";
type View = {
  version: number;
  status: string;
  error: string | null;
  skipped: number;
  canRetry: boolean;
  fallback: boolean;
  language: keyof typeof labels;
  items: Fact[];
};
const labels = {
  "en-IN": {
    title: "Meeting outcomes",
    summary: "Summary",
    decision: "Decisions",
    action: "Action items",
    commitment: "Commitments",
    question: "Unresolved questions",
    agreed: "Agreed",
    proposed: "Proposed",
    unresolved: "Unresolved",
    reported: "Summary",
    owner: "Owner",
    due: "Deadline",
    empty: "No supported items were found.",
    evidence: "Evidence",
  },
  "te-IN": {
    title: "సమావేశ ఫలితాలు",
    summary: "సారాంశం",
    decision: "నిర్ణయాలు",
    action: "చర్యలు",
    commitment: "హామీలు",
    question: "సమాధానం లేని ప్రశ్నలు",
    agreed: "అంగీకరించారు",
    proposed: "ప్రతిపాదించారు",
    unresolved: "తేలలేదు",
    reported: "సారాంశం",
    owner: "బాధ్యత",
    due: "గడువు",
    empty: "ఆధారాలు ఉన్న అంశాలు ఏవీ లభించలేదు.",
    evidence: "ఆధారం",
  },
};
export function Report({
  room,
  preferred,
  onEvidence,
}: {
  room: string;
  preferred: Language;
  onEvidence: (id: string) => void;
}) {
  const [language, setLanguage] = useState<keyof typeof labels>(
      preferred === "hi-IN" ? "en-IN" : preferred,
    ),
    [view, setView] = useState<View | null>(null),
    [error, setError] = useState("");
  const [tick, refresh] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await api<View>("/" + room + "/report?lang=" + language);
        if (!live) return;
        setView(next);
        setError("");
        if (next.status === "pending")
          await api("/" + room + "/report/generate", {});
        if (live && ["pending", "generating"].includes(next.status))
          timer = setTimeout(load, 1200);
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    }
    void load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [room, language, tick]);
  const words = labels[view?.language ?? language];
  return (
    <div className="report">
      <h2>{words.title}</h2>
      <label>
        Report language
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as keyof typeof labels)}
        >
          {Object.entries(languages)
            .filter(([code]) => code in labels)
            .map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
        </select>
      </label>
      {(!view || ["pending", "generating"].includes(view.status)) && (
        <p role="status">Preparing the evidence-linked meeting record…</p>
      )}
      {!!view?.skipped && (
        <p>{view.skipped} turn(s) had no transcript and were excluded.</p>
      )}
      {view?.fallback && (
        <p>
          Showing the canonical English wording while Telugu is unavailable.
        </p>
      )}
      {view?.status === "failed" && (
        <p role="alert">
          Report processing stopped · {view.error || "Attempt limit reached"}
        </p>
      )}
      {view?.status === "failed" && view.canRetry && (
        <button
          onClick={async () => {
            try {
              await api("/" + room + "/report/retry", {});
              refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Retry report
        </button>
      )}
      {view?.status === "ready" && !view.items.length && <p>{words.empty}</p>}
      {(
        ["summary", "decision", "action", "commitment", "question"] as const
      ).map((kind) => {
        const items = view?.items.filter((i) => i.kind === kind) ?? [];
        if (!items.length) return null;
        return (
          <div key={kind}>
            <h3>{words[kind]}</h3>
            {items.map((f) => (
              <article key={f.id}>
                <p>{f.text}</p>
                {kind !== "summary" && <strong>{words[f.status]}</strong>}
                {f.owner && (
                  <p>
                    {words.owner} · {f.owner}
                  </p>
                )}
                {f.deadline && (
                  <p>
                    {words.due} · {f.deadline}
                  </p>
                )}
                {f.evidence.map((e, i) => (
                  <button
                    className="citation"
                    key={i}
                    onClick={() => onEvidence(e.turnId)}
                  >
                    {words.evidence} · “{e.quote}”
                  </button>
                ))}
              </article>
            ))}
          </div>
        );
      })}
      {error && (
        <p role="alert">
          {error} <button onClick={refresh}>Refresh report</button>
        </p>
      )}
    </div>
  );
}
