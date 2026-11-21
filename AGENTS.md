# AGENTS.md — Sahva coding instructions

You are implementing Sahva. **Do not code until you have read** `README.md`, `docs/01_PRD.md`, `docs/02_SCOPE_ACCEPTANCE.md`, `docs/04_APPROACH_ARCHITECTURE.md`, `docs/07_API_AND_EVENT_CONTRACTS.md`, `GLOSSARY.md`, and the **last** update in `PROJECT_SUMMARY.md`. See `agent/STARTUP_PROMPT_TEMPLATE.md` for complete start-of-session protocol.

## Operating rules

1. Inspect the actual repo branch, HEAD, upstream, status, diff, and untracked files first. Never reset/stash/rebase/overwrite unrelated changes without explicit permission. The pack contains **no claim that a repo exists or that its state is clean**.
2. Work one numbered ticket from `docs/08_WBS_AND_PHASE_PLAN.md` at a time; implement a demonstrable vertical path, not a whole backend first.
3. Use TypeScript strict mode, server-only secrets, explicit input validation, typed domain outputs, and tests for business invariants.
4. Keep external speech, translation, and TTS behind provider adapters; log latency and failures without audio or transcript text.
5. No client-exposed Sarvam key or Supabase service role key. Private audio access must be scoped to authorized participants.
6. Never transform uncertain statements into agreed facts. Manual overrides must preserve the original transcript and provenance.
7. Prefer the simplest viable implementation; no voice cloning, telephony, extra languages, streaming, complex agent frameworks, or video in P0.
8. Run locally available tests and report exact commands/results. Do not claim verification you did not perform.
9. Before handing off, append a concise dated record to `PROJECT_SUMMARY.md` using `agent/PHASE_UPDATE_TEMPLATE.md`; update ADRs/spec only if a decision changed. Do not rewrite past phase history.
10. When using Matt Pocock skills in an agent environment, follow their current installed content. This pack is self-contained even without them.

## Decision precedence

Newest **accepted ADR** > PRD requirements > scope/acceptance > detailed technical design > task ticket > prompt commentary. A phase summary reports facts and does not silently override the spec. If two sources conflict, stop the conflicting change, propose an ADR, and continue only on unaffected work.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


Before GPU or model work, read ADR-0008, the research pack, the latest ledger entry and the deployment runbook. Inspect all pending changes and active experiments. Preserve consent, private media and report evidence. Record measured results and obtain a scoped budget before provisioning.
