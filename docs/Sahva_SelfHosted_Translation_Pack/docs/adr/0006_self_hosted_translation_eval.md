# ADR-0006 — Evaluate modular self-hosted interpretation stages

**Date:** 2026-11-21
**Status:** PROPOSED (research decision; requires benchmark/production review)

## Context
Sahva's public LiveKit/Sarvam pipeline is functional and retains evidence-linked reports, but the interpreted audio lags a finalized phrase. Experimenting with direct S2ST (Gemini) has not yet produced compelling Telugu quality. Open-weight Indic MT, ASR and TTS models now provide an alternative that can be hosted on GPUs, but not necessarily with better total quality/latency.

## Decision
Build a **stage-level adapter architecture** while keeping Sarvam production default. First test a small distilled IndicTrans2 translation service on a private GPU, keeping all other processing unchanged. Independently benchmark Maya streaming TTS; swap ASR only if ASR failures are established. Do not co-host multiple models without measured VRAM and workload proof.

## Rationale
Modularity allows isolating recognition, translation, synthesis, segment scheduler, network and playback costs. Existing recordings and canonical evidence need text/source attribution and versioned history. A managed fallback protects the live demo. Stagewise experiments use the current harness as the base and provide clearer empirical data than a full-model replacement.

## Consequences
- Additional Python GPU worker, stage protocols, auth, observability, billing, CI/deployment and per-model revision management.
- Larger models (Bodhan Indic Translate) may require 24GB minimum alone; hosted-service licensing review is mandatory.
- Direct S2ST systems remain possible as independent adapters, not default.
- Real-time output may still be limited by segmentation and language word order.

## Acceptance evidence required to mark ACCEPTED
1. Same-recording A/B with human source/target ground truth, both language directions.
2. Useful improvement in critical correctness or latency without unacceptable regressions.
3. Cost and GPU memory/capacity measured; no unbounded idle bills.
4. All original LiveKit/consent/report regression scenarios pass.
5. License and privacy assessment completed.
6. Authorized release/rollback plan documented.

## Alternatives rejected for this phase
- Train a new model from scratch: no dataset, GPU budget, evaluation evidence.
- Directly replace production Sarvam with a self-hosted composite: too risky before baseline.
- Default to Meta Seamless checkpoint: unresolved noncommercial model licensing and Telugu output path.
- Host a large translation model and streaming TTS on one 24GB GPU without profiling: likely memory collision.

## Review date
After translation-only A/B and TTS-only evaluations, or sooner if a better research model becomes available.
