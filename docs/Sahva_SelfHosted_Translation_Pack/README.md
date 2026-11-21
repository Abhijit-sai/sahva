# Sahva — Self-hosted Translation Engine Research & Implementation Pack

**Date:** 2026-11-21  • **Status:** Proposed / unverified experiments  • **Owner:** Sahva engineering

> Decision: **Keep the deployed Sarvam/LiveKit path untouched by default. Build a separate GPU inference worker and a pluggable stage-level evaluation harness; replace individual stages only after measured improvement.** Do **not** fine-tune or host all models together before proving feasibility.

## What is in this pack

| File | Use |
| --- | --- |
| `docs/01_DECISION_AND_ROADMAP.md` | Recommended approach, alternatives, gates, milestones |
| `docs/02_RESEARCH_MODELS_AND_LICENSES.md` | Models, evidence, limitations, licenses and candidate ranking |
| `docs/03_TARGET_ARCHITECTURE.md` | Streaming segmentation, fan-out, server boundaries, state and fallbacks |
| `docs/04_GPU_DEPLOYMENT_AND_COSTS.md` | GPU selection, topology, capacity, operational runbook, budget |
| `docs/05_ADAPTER_API_CONTRACTS.md` | Internal stage and streaming event contracts with example payloads |
| `docs/06_BENCHMARK_AND_EVALUATION.md` | Fair benchmarks, recording manifest, success metrics and decision rules |
| `docs/07_WBS_PHASE_PLAN.md` | Dependency-ordered vertical implementation tickets |
| `docs/08_SECURITY_PRIVACY_COMPLIANCE.md` | Consent, voice cloning, recordings, model licenses, security |
| `docs/09_EXISTING_DOC_PATCH_PLAN.md` | Exact changes to existing Sahva documents, without overwriting history |
| `docs/10_RISKS_OPEN_QUESTIONS.md` | Assumptions, risks, decisions requiring evidence |
| `docs/11_OPERATOR_PLAYBOOK.md` | Operational procedures, rollbacks, test scripts and acceptance |
| `docs/12_SOURCES.md` | Public references, verification dates, caveats |
| `docs/adr/0006_self_hosted_translation_eval.md` | Proposed ADR; do not mark Accepted prematurely |
| `templates/NEW_CODEX_SESSION_PROMPT.md` | Copy-ready Codex prompt for an isolated implementation phase |
| `templates/PHASE_UPDATE_TEMPLATE.md` | Append-only session update format |
| `templates/benchmark_manifest.csv` | Structured fixture metadata seed, no pretend results |

## Snapshot versus deployed application

Reviewed the connected GitHub repository `Abhijit-sai/sahva`, default `main` at **`3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f`**. GitHub code may be newer in an active Codex workspace. Public deployment was reported at **`c7011ab`** with LiveKit Cloud groups and the Sarvam pipeline. **Before changing code, Codex must inspect its actual working tree, active branches, latest summary, pending deployments and provider experiments.**

Verified in this inspected revision:

- `lib/server/meeting.ts` receives independent 100-ms PCM microphone frames from LiveKit tracks and forwards to live speech processing.
- `lib/server/live.ts` manages Saaras streaming partial/final transcript sessions and drafts.
- `lib/server/turns.ts` persists and processes original turns and Mayura/Bulbul deliveries.
- `lib/providers/sarvam.ts` is directly coupled to Sarvam stages; there is no general multi-provider stage interface.
- `scripts/compare-directions.ts` feeds same WAV input into two Sarvam processing paths; it is **not** a complete cross-provider UI lab.
- `docs/08_WBS_AND_PHASE_PLAN.md` has no self-hosted GPU track.

Thus: **The existing harness can be extended; do not assume the dropdown works as-is.** The dropdown should register self-hosted engines once the new adapter exists and passes health/capability tests. No modifications have been made to the user's GitHub repository by this pack.

## Core safety and honesty requirements

- No production default-engine changes without A/B evidence and explicit release approval.
- Real GPU tests, costs and latency must be measured; none are claimed completed here.
- Bodhan model weights use the Indic Open Model License; evaluate hosted API restrictions and Gemma/Canary upstream terms before commercial use.
- Meta Seamless weights are noncommercial research candidates; do not deploy them to commercial Sahva.
- Source recordings, consent withdrawal, participant attribution, multilingual summaries and citations are non-negotiable.
- New workers should be private, authenticated, budget-capped, kill-switchable, and located close to the application/audio edge.

## Starting order

1. Run existing code and benchmark harness unchanged to capture a repeatable Sarvam baseline.
2. Build `selfhost-indictrans2` as **translation-only** worker, retaining Sarvam STT and TTS.
3. Run blinded A/B tests in both directions; profile GPU cost and latency.
4. Build `selfhost-maya-tts` as **voice-only** experiment, keeping best validated ASR/MT.
5. Test optional ASR alternatives; investigate Bodhan MT only after licensing, access and GPU planning.
6. Add stage/model dropdown and compare screen to existing Sahva laboratory; gate feature behind internal flag.
7. Decide if/how a compositional self-hosted engine enters beta. Keep the existing Sarvam default.
