# 09 — Exact patch instructions for existing Sahva docs

**Do not overwrite canonical files from a ZIP without checking current Git HEAD.** The following is a reviewable change manifest. Use current repository documentation as source of truth; insert/merge text only where accurate, and append an update to `PROJECT_SUMMARY.md`.

## Root `README.md`
Add a concise **Experimental self-hosted translation** section linking to the new ADR and the new docs. State that `sarvam-standard` remains production default and GPU model evaluations are not deployed by default.

## Root `AGENTS.md`
Add an instruction: before model/GPU changes, read the active ADR, new self-hosted docs, latest project summary and deployment runbook; inspect local branch/diff/untracked; no automatic reset/stash/branch switch; only claim measured performance from real tests; preserve all room security and report contracts.

## `docs/01_PRD.md`
Add an optional internal `Translation Lab` use case: administrator/tester can select eligible source/target and engine stages, replay same recording and compare accuracy/latency. Normal users only set speaking/listening language. Add privacy and explicit experimental labeling. Avoid claiming all stages are self-hosted before they are.

## `docs/02_SCOPE_ACCEPTANCE.md`
Add feature-flagged experimental scope only, not P0. Proposed acceptance: compatible/ready dropdown; A/B same-recording; human critical-slot review; live test-room routing; original/translated evidence intact; consent/permissions valid; Sarvam rollback. Keep presenter group mode scope separate.

## `docs/03_UX_AND_USER_FLOWS.md` and new `DESIGN.md` (if currently in repo)
Add `Advanced → Translation Engine (experimental)` for tester roles only; model options depend on verified language pairs and health. A separate lab compares source, A/B outputs, audio controls, model revision, timing and reviewer notes. Do not alter guest-first simple join flow or add GPU jargon to main meeting.

## `docs/04_APPROACH_ARCHITECTURE.md`
Add a dedicated diagram and explanation of **stage-level pluggable orchestration**: LiveKit independent source track → ASR → stable segment scheduler → MT → TTS streaming → listener queue; private GPU worker for selected stages; per-room/per-target fanout; fallback; cancellation; report compatibility. Mark old architecture as live production, new architecture as proposed. Link ADR.

## `docs/05_TECH_STACK_AND_PROVIDERS.md`
Add a dated model registry table referencing exact HF model IDs, license/access, roles, revisions, hardware hypotheses. Include IndicTrans2 distilled, Maya, IndicConformer, optional Bodhan and research Seamless. Explicitly distinguish model vendor benchmarks from Sahva results. Keep Sarvam production facts unchanged. Add GPU transport and security.

## `docs/06_DATA_MODEL.md`
Propose optional `translation_run` or metadata columns **only if the existing tables cannot represent engine IDs/revisions and test results**. Prefer standalone lab schema/storage for experiments over changes to live production rows. Required metadata: speaker/turn IDs, revision, source/target language, stage engine/version, timings, audio artifact refs and status; never rewrite source recording.

## `docs/07_API_AND_EVENT_CONTRACTS.md`
Add internal model capability, stage adapter and worker contract described in `05_ADAPTER_API_CONTRACTS.md`; distinguish draft caption, committed source transcript, translated text, TTS started/chunk/finished and playback started. Ensure all messages are consent-epoch scoped and cancellable. Existing public room API should remain backward compatible.

## `docs/08_WBS_AND_PHASE_PLAN.md`
Append new `GPU-` and `LAB-` tickets in `07_WBS_PHASE_PLAN.md`. **Do not renumber historical milestones** or mark unrun tests as complete. Deployment changes require approval and scoped tests.

## `docs/09_QA_AND_DEMO.md`
Add four distinct evaluation modes (MT-only oracle text, ASR-only, TTS-only oracle target, complete live room); benchmark 30+ clips per direction, critical slot human labels, cold/warm p50/p95, headphone and speakerphone routes, two and three concurrent speakers, original replay, consent revoke, benchmark reproducibility.

## `docs/10_SECURITY_AND_PRIVACY.md`
Add external GPU worker as a new processor with private network, credentials, cross-region disclosure, ephemeral buffering, consent cancellation, model supply-chain/licensing and optional voice cloning controls. No claims of fully self-hosted privacy when other stages call external APIs.

## `docs/11_RISKS_AND_OPEN_QUESTIONS.md`
Add GPU billing, model availability, Indic Translate license rights, cold-start, TTS OOM, GPU location latency, script normalization, simultaneous speakers and human translation evaluation. Maintain status/owners.

## `docs/12_RESEARCH_AND_SOURCES.md`
Append source URLs and date reviewed. Mark provider claims, research, tested repo snapshot and pending verification separately. Do not copy vendor performance into production benchmark results.

## `docs/13_CODING_STANDARDS.md`
Add model adapter tests, inference worker protocol validation, pinned dependencies, cancellation, idempotency, timeouts and fixture privacy. Use existing type/lint/testing frameworks and separate Python worker tests.

## Existing ADRs (`docs/adr/`)
Do not rewrite previous accepted decisions about LiveKit, data model and consent. Add new proposed ADR (included here) with clear evidence gates; only mark Accepted after real A/B validation and decision.

## `PROJECT_SUMMARY.md`
Append new dated entry (never edit old entries): snapshot, comparison harness inspected and limitations, proposed GPU route, completed documentation research only, selected tickets, license and GPU budget blockers, next action. Include actual branch, SHA, diff and whether another Codex session is active.

## `agent/STARTUP_PROMPT_TEMPLATE.md`
Add new phase instruction to read the self-hosted docs and current ADR, inspect GPU process and current room engine config. Maintain current root documentation order and the actual repo state check.

## `ops/AWS_DEPLOYMENT.md`
Keep Oregon EC2 as present. Add optional private GPU worker endpoint, network restriction, worker health, GPU start/stop, cost cap, region, rollbacks; do not silently provision another AWS instance. GPUs can live in a separate provider initially.

## New repository additions (suggested)

```text
docs/research/selfhost/
  README.md
  01_DECISION_AND_ROADMAP.md ...
  12_SOURCES.md
docs/adr/0006_self_hosted_translation_eval.md
services/inference-gpu/  # only after repo preflight and architecture review
scripts/benchmarks/      # or extend current scripts
```

This pack is suitable as a **reviewed addendum**; the actual GitHub repository is not modified by generating it.
