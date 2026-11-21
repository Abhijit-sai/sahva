# 12 — Research sources and provenance

**Checked on 2026-11-21.** URLs below are the originating public source pages. Vendor numbers are quoted as **author/vendor-reported**, and prices can change. Sahva first-party observations are limited to inspected repository files and project records.

## Sahva repository snapshot
- https://github.com/Abhijit-sai/sahva (default `main` observed at `3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f`)
- https://github.com/Abhijit-sai/sahva/blob/main/scripts/compare-directions.ts — same-recording Sarvam batch vs streaming; not a general provider dropdown in snapshot.
- https://github.com/Abhijit-sai/sahva/blob/main/lib/server/meeting.ts — 100ms per-microphone LiveKit frames.
- https://github.com/Abhijit-sai/sahva/blob/main/lib/server/live.ts — streaming Saaras captions.
- https://github.com/Abhijit-sai/sahva/blob/main/lib/server/turns.ts — persisted stages.
- https://github.com/Abhijit-sai/sahva/blob/main/lib/providers/sarvam.ts — current provider stages.
- https://github.com/Abhijit-sai/sahva/blob/main/docs/08_WBS_AND_PHASE_PLAN.md — existing accepted phase planning.
- https://github.com/Abhijit-sai/sahva/actions/runs/44894300610 — earlier public deployment, separate from new experiments.

## MT
- https://github.com/AI4Bharat/IndicTrans2 — code, checkpoints, evaluation, licensing.
- https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M — Indic→English 200M MIT checkpoint.
- https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M — English→Indic 200M MIT checkpoint.
- https://huggingface.co/bodhan-ai/indic-translate — longer-context MT model, manufacturer benchmarks, hardware 24GB minimum and Indic Open Model License. Note some human ratings describe previous release.
- https://github.com/Bodhan-AI/bodhan_genai — toolkit and model-family links.
- https://github.com/OpenNMT/CTranslate2 — inference conversion and optimization (compatibility requires test).

## ASR
- https://github.com/AI4Bharat/IndicConformerASR — MIT ASR models including Telugu.
- https://models.ai4bharat.org/ — Conformer and streaming demos.
- https://huggingface.co/bodhan-ai/indic-transcribe-core — speech model, code-mixing, offline chunking, license.

## TTS
- https://github.com/MayaResearch/maya2-native — engine (Maya3 package), CUDA versions, WebSocket and GPU benchmark, Apache-2.0, third-party components.
- https://huggingface.co/maya-research/maya2-native — weight model card.

## Streaming research
- https://github.com/ufal/SimulStreaming — stable-prefix processing and read/write policies, MIT code.
- https://ai.meta.com/resources/models-and-libraries/seamless-communication-models/ — SeamlessStreaming / expressive MT research.
- https://github.com/facebookresearch/seamless_communication — research implementations, model licensing to verify.
- https://github.com/kyutai-labs/hibiki — simultaneous speech architecture; limited public language pair.

## Compute / hosting
- https://www.runpod.io/product/cloud-gpus — public GPU list/hourly examples, change by region & stock.
- https://www.runpod.io/pricing — serverless pricing and GPU options; different from dedicated Secure Cloud prices.

## Research interpretation
- Source/checkpoint license can differ from repository license; read full binding model license.
- A 14ms single-stream Maya TTFA measured by authors on H100 is **not** a whole interpreted sentence translated in 14ms.
- A source language being recognized does not guarantee spoken output in that language.
- Model card chrF++ (text benchmark) does not measure code-mixed speech, translation stability, concurrent media flow, or final listener hearing.
- No user-provided code, local Codex worktree or GPU host was modified, executed or validated during creation of this pack.
