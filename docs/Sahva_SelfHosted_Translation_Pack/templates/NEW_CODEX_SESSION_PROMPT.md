# SAHVA — SELF-HOSTED TRANSLATION RUNTIME EXPERIMENT
## Existing Codex project, new isolated phase; follow actual repository evidence

You are the Lead Realtime Speech Engineer for Sahva. This is **not a new product or replacement of a working deployment**. We have a functioning LiveKit/Sarvam multilingual group-call application with original recordings, listener-specific translation and evidence-linked meeting notes. The objective is to test whether modular self-hosted ASR/MT/TTS engines on GPU can improve **meaning accuracy, listening delay and expressive speech** for Telugu↔English and later Hindi↔English.

A new research pack is available in `Sahva_SelfHosted_Translation_Pack/` (find actual path), including `README.md`, architecture, model research, GPU deployment, adapter contracts, evaluation and WBS, proposed ADR-0006, security/licensing, and patch plan for existing docs.

## Mandatory preflight before any mutation

1. Inspect actual current repository root, branch/HEAD, upstream/remote, staged/unstaged/untracked, full diff and recent commits. Other Codex sessions may be editing the application. **Never reset, stash, clean, discard, rebase, switch branch or auto-create a worktree** without establishing safety and authorization.
2. Read root `AGENTS.md`, `README.md`, newest dated entries in `PROJECT_SUMMARY.md`, latest accepted ADRs, deployment runbook and `docs/08_WBS_AND_PHASE_PLAN.md` before the new pack. Read the complete research pack including `docs/09_EXISTING_DOC_PATCH_PLAN.md`.
3. Reconcile the pack's known GitHub snapshot (`3655e76` on 2026-11-21) against the **actual checkout**. It might be outdated: do not assume the app still lacks a multi-provider dropdown if code has since shipped.
4. Inspect actual `lib/server/meeting.ts`, `lib/server/live.ts`, `lib/server/turns.ts`, `lib/providers/sarvam.ts`, `scripts/compare-directions.ts`, any new Gemini/OpenAI/Qwen adapters, deployment config and benchmark UI.
5. Confirm all current provider and model rights, model revisions, GPU region/availability and costs from original docs before implementing.

## First deliverable: accurate documentation updates

- Add new proposed self-hosted ADR; do not change accepted LiveKit architecture decision or mark untested results completed.
- Follow `docs/09_EXISTING_DOC_PATCH_PLAN.md`: minimally update canonical PRD, architecture, provider tech stack, contracts, WBS, benchmark QA, privacy/security, risks, deployment runbook, startup prompt and sources. Do not create contradictory duplicate sources of truth.
- Record the actual verified implementation, what remains hypothetical, model licensing/access checks, GPU budget constraints and open tasks. Append planning entry to `PROJECT_SUMMARY.md` using `templates/PHASE_UPDATE_TEMPLATE.md`.
- Keep production Sarvam as default and all public services untouched.

## Implementation strategy — stagewise, evidence-driven

### Stage A — Baseline harness
Extend the actual existing same-recording comparison harness instead of replacing it. First rerun the unchanged Sarvam baseline with **consented** English and Telugu WAV fixtures. Preserve audio hashes and first-class stage timings. Plan blinded bilingual human assessment and create fixture manifest. Compare ASR, MT and TTS *separately*, then the full paced streaming path.

### Stage B — Self-hosted IndicTrans2 translation
Verify HF access and MIT checkpoint terms. Prototype a **private GPU/CPU translation-only worker** using `ai4bharat/indictrans2-indic-en-dist-200M` and `ai4bharat/indictrans2-en-indic-dist-200M`, pinned to exact revision. Use official Indic preprocessing and proper language tags. Produce private authenticated /translate endpoint and capabilities/readiness; guard source and target pair and payload length. First run same *human-corrected* transcript through Sarvam Mayura and IndicTrans2, both directions. Record actual quality, critical slots, latency and GPU stats. **Do not touch live ASR or TTS at this point**.

### Stage C — Lab dropdown and stage adapters
Create a stage-level capability registry plus private internal `Translation Lab` interface for selecting ASR/MT/TTS or whole pipeline and supported source/target pairs. Only list healthy, licensed, configured engines; show unsupported states truthfully. For the MT comparison, use identical human source text; for TTS, identical human target text; for ASR, identical source audio; for full streaming, paced original audio. Track provider, model SHA, revision, timings, queue and errors. Show original audio + translated audio, actual outputs and a bilingual-review field. Keep normal user UX simple; lab/tester feature flag only.

### Stage D — Maya streaming TTS experiment
Only after Stage B is evaluated, verify Apache-2.0 weights and upstream license notices, GPU runtime dependencies and actual Maya package naming. Host Maya as a separate service, or a co-hosted worker **only if real VRAM and concurrency measurements permit**. Test streaming Telugu/English audio using identical verified text as Bulbul. Capture first *decodable* audio, full playback, naturalness, stalls, cold/warm behavior, VRAM, error handling and cost. Do not promise cloned-voice identity; voice cloning requires explicit participant consent and is not in default scope.

### Stage E — ASR and stronger MT experiments
Only if existing ASR errors are a measured limiting factor, benchmark IndicConformer against Saaras using consented source recordings. Bodhan Indic-Transcribe is an optional additional offline benchmark, not an assumption of continuous ASR. Bodhan Indic Translate may run only after its gated model access, Indic Open Model License hosted-service provisions and Gemma upstream conditions are reviewed, and an isolated >=24GB GPU test is approved. It is **not** the first experiment.

### Stage F — Live room integration and decision
If tests show a measurable advantage, connect stage adapters into the existing LiveKit per-speaker server path **behind a flag in a test room**, at stable segment boundaries, preserving original audio, consent epoch, speaker attribution, per-target fanout, translated audio queues and canonical meeting record. Avoid feedback loops. Never promote production automatically; present a scorecard and request release approval.

## GPU operational safeguards

- No provisioning of paid GPU resources without explicit authorization for SKU, region, hourly rate and time budget; prepare containers/config offline if needed.
- Worker should be private, authenticated, rate-limited, pinned and stoppable. No direct browser/unauthenticated access. No transcripts/audio in application logs.
- Start with a temporary 24GB GPU; no assumption it runs Bodhan's ~15.9GB weights plus Maya's ~9.2GB peak concurrently. Consider separate workers or larger GPU after profiling.
- Measure end-to-end listening delay and total cost per successful translated minute, not merely model TTFA.

## Mandatory tests / ship gates

- Typecheck, lint, unit, worker tests, browser tests, E2E and regression for public rooms.
- Same real recordings across candidates with proper human references, both directions, critical negations/numbers/names/dates; p50/p95 latency under realistic audio pacing; explain missing benchmark results.
- Unauthorized/consent-withdrawn request denial, cross-room isolation, cancellation, OOM, worker death, fallback, reconnect, no duplicate audible playback, no report evidence loss.
- Keep Sarvam as production default until explicit human-reviewed better quality/latency result + privacy/license approval + production authorization.

## Continuous context management
After each meaningful phase append, never overwrite, `PROJECT_SUMMARY.md` with branch/HEAD, files, changes, tests with actual results, GPU cost/time/stop state, model/checkpoint revision, open risks, benchmark outcomes and next task. Update canonical docs, accepted ADR status only when justified and preserve historical project records.

## First response and execution autonomy
Give a concise kickoff assessment: actual Git state and conflicts, active docs/current provider/harness, source code boundaries, model licensing, exact first tickets, credentials/GPU authorization gaps. Then update docs and proceed with the first safe unblocked task. If GPU credentials/cost approval are unavailable, complete documentation, reusable interface/harness and local tests; don't wait idly. Ask only about truly blocking choices, destructive action or paid resource authorization.

**Goal:** establish evidence that Sahva's self-hosted components improve real multilingual conversations, rather than deploying an exciting model with untested claims. Begin now.
