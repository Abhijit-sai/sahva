# 02 — Research: models, licenses, hardware, tradeoffs

**Reviewed 2026-11-21.** Model cards are vendor/authors' claims, not Sahva results. Re-verify checkpoint hashes, revisions, licenses, weights, dependencies and actual access before download or deployment.

## Translation models

### IndicTrans2 distilled — first experiment
- Weight IDs: `ai4bharat/indictrans2-indic-en-dist-200M` (Telugu → English) and `ai4bharat/indictrans2-en-indic-dist-200M` (English → Telugu). These are **two separate direction-specific checkpoints**, not a single auto-direction file.
- 200M-param class each; MIT checkpoint license per project and model cards. Model downloads may require accepting Hugging Face gating conditions.
- Strong fit: deterministic short-segment MT, source glossary/protected entities via preprocessing, potentially much cheaper GPU use than a 7B+ general MT model.
- Limits: text-only, not streaming by itself; needs stable segments, proper language tags and Indic preprocessing (`IndicProcessor`), handling of Telugu script versus romanized input, robust punctuation and numeric normalization. Tiny segment translation may be contextually wrong.
- Benchmark the exact available checkpoint revision using locked dependencies; compare both directions separately. Try CTranslate2 only after verifying conversion and output parity.

### Bodhan Indic Translate — later quality candidate
- Model `bodhan-ai/indic-translate`, English ↔ 22 Indian languages, Gemma 4 E4B-based; runs unquantized BF16 with ~15.9GB weights and **minimum 24GB GPU** for sentence/paragraph according to model card; 40GB+ recommended for long documents.
- As of 2026-11-21, **gated** download and **Indic Open Model License v1.0**; full terms and Gemma upstream terms apply. Commercial self-hosted product use may be possible, but hosting as a model API for other companies/users has particular sign-off / disclosure conditions. Have counsel or the model owner verify suitability for Sahva before production. Do not treat the plain-language summary as legal approval.
- Manufacturer's IN22 sentence-level chrF++ results are **mixed**: English→Indic Sarvam 48.9, Indic Translate 47.7, IndicTrans2 46.4; Indic→English Gemini 66.6, IndicTrans2 62.5, Indic Translate 60.4, Sarvam 52.4. For **Telugu**, English→Telugu Indic Translate 51.3 vs Sarvam 51.6 vs IndicTrans2 51.6; Telugu→English Indic Translate 62.7 vs Sarvam 53.1 vs IndicTrans2 64.7. These are author-reported benchmark scores, not live Sahva quality, nor a fair comparison of available Sarvam API versions without verification.
- Older human review of the *previous release* is not a validation of the current checkpoint. Sentence-level segmentation may have different outcomes from document-context metrics. Review sample failures with fluent bilingual speakers.
- Authors recommend a specific prompt pack; prompts not following it can return plausible but inferior translations. No automatic inference of improvement.

## Recognition models

### AI4Bharat IndicConformer — candidate first ASR swap
- Telugu and 21 other scheduled languages, MIT license, relatively light models, source inference code available.
- Not necessarily a true stateful online incremental transcriber out of the box; benchmark overlapping windows and stability handling. Check audio normalization, script/romanization, accents and speech-specific timing.

### Bodhan Indic-Transcribe Core — optional quality benchmark
- ~1.2B Canary-based offline/short-window ASR supporting Indic code mixing; input clips up to ~45 seconds before splitting, long form helper chunks ~30 seconds. Not a ready-made continuous streaming socket.
- Indic Open Model License with upstream NVIDIA Canary terms. Inference license and hosted API carve-outs need review; do not ship before approval. Compare WER/CER on Telugu names and negations using human references.

## TTS models

### Maya 2 Native (package identified in repo as Maya3) — first TTS swap
- `maya-research/maya2-native`, Apache-2.0 weights and code (with third-party notices for Mimi CC-BY-4.0, Qwen-based backbone and speech embedding components), Telugu/English/Hindi among 12 languages, 20 built-in voices, optional consented reference voice.
- Python streaming/async and HTTP/WebSocket server. Published 80-ms speech frames; claims ~14ms single-stream first audio **on H100**, with peak GPU usage ~9.2GB at max_seats=1; throughput results are **not** whole Sahva conversational delay and may not transfer to a 24GB L4.
- CUDA 12.8 Linux, NVIDIA GPU, Python constraints; support OOM/backpressure, model warmup, text normalization and codec resampling. The brand/model and package naming differ; lock exact revision and verify installed import (`maya3`).
- Voice cloning **opt-in only** with explicit speaker identity/consent, removal, abuse controls. Do not include in initial default experiment.

### Indic-Speak — alternative expressive TTS
- Bodhan Indic-Speak offers many Indian-language voices but is more complex and uses Indic Open Model License; audio quality, latency and license restrictions all require evaluation. Lower priority than Maya for streaming voice.

## Research models (not default production)

- **Meta SeamlessM4T / SeamlessStreaming:** learned read/write segmentation and direct speech translation; output coverage is narrower than input coverage, and checkpoint-level Telugu speech support must be demonstrated. Repo/checkpoints have noncommercial terms for some weights. Research only until rights and exact paths verified.
- **Kyutai Hibiki:** impressive streaming S2ST architecture and voice transfer; publicly released pair primarily French→English. Not a Telugu implementation. Good paper/code reference, not a direct drop-in.
- **UFAL SimulStreaming:** MIT-licensed research implementation of incremental Whisper + translation; stronger relevance is segmentation/confirmation policies and latency measurement, not plugging its European language MT models directly into Telugu.

## Recommended evaluation order
1. **Current Sarvam**: original audio, ASR, Mayura, Bulbul, latency baseline.
2. **Sarvam ASR → IndicTrans2 MT → Sarvam TTS**: isolates MT quality and delay.
3. **Sarvam ASR → best tested MT → Maya TTS**: isolates voice.
4. **IndicConformer ASR → best tested MT/TTS**: isolates ASR.
5. **Bodhan Indic Translate** as alternate translator after access/license & GPU sizing.
6. **Direct research S2ST** only as side experiments, without forcing unsupported Telugu output.

## Model reproducibility
Record for each run: repo and commit, HF model revision SHA, license snapshot, preprocessing revision, tokenizer revision, precision/quantization, GPU model/VRAM, CUDA/driver/runtime, VAD/commit policy, target language, voice and post-processing. Vendor-reported benchmarks must never be inserted into Sahva scorecards as first-party evidence.
