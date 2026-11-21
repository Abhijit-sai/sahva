# 01 — Product and Engineering Decision

## Problem
Sahva has a deployed audio-room system: LiveKit group microphone tracks, Sarvam streaming STT, Mayura translation, Bulbul audio, private original recordings, source-linked notes and reports. It works but delays audible speech until phrase finalization and sometimes mistranslates critical speech. Direct S2ST experiments have not yet demonstrated a reliable Telugu ↔ English improvement.

## Decision (proposed)
Build **Sahva Interpreter Runtime** as a modular **streaming ASR + translation + streaming TTS** orchestration service, allowing independent GPU/self-hosted or API-backed providers per stage and language pair. Keep the deployed implementation as `sarvam-standard` and the fallback until experimentation proves a better path.

Prioritize **semantic correctness and stable segmentation before speaker likeness**. We can improve the stage pipeline without inventing a new model.

### Why not direct S2ST as default today?
- A single end-to-end model can have difficult-to-debug attribution, glossary, revision, alignment and output-language limitations.
- Some direct S2ST checkpoints are multilingual in input but not in Telugu speech output; other research models carry noncommercial restrictions.
- The application already has source evidence and post-call reporting tied to text segments. Stage separation preserves these capabilities.
- The current Gemini test was reportedly not accurate enough. New models must earn adoption through same-recording comparisons.

### What we **will not** claim
- Owning the training data or the foundation models.
- Ultra-low latency from model card TTS timing alone.
- That hosting a large model on a GPU automatically increases accuracy.
- That a translation-only benchmark equals natural full-duplex meeting quality.

## Approach options

| Path | Initial cost/time | Quality control | Latency potential | Risk | Decision |
| --- | --- | --- | --- | --- | --- |
| Retain Sarvam, optimize chunk scheduling | Low | Medium | Significant possible gain | Low | Baseline + near-term improvements |
| Swap IndicTrans2 translation on GPU | Low/medium | High terminology/data control | Depends on scheduler | Medium | **First self-hosted experiment** |
| Swap Maya streaming TTS on GPU | Medium | Voice/stream control | Promising TTS latency | Medium | **Second experiment** |
| Replace ASR with IndicConformer/Bodhan | Medium | Accent/glossary control | Requires genuine streaming adaptation | Medium/high | Only after ASR error evidence |
| Host Bodhan Indic Translate | Medium/high | Richer context/translation | 24GB minimum for MT alone | License + latency | Evaluate later |
| Train/fine-tune direct SimulS2ST | Very high | High after large research effort | Unknown | Very high | Out of scope now |
| Meta SeamlessStreaming | High | Research control | Potential | Commercial restriction | Research only |

## Stagewise evidence gates

- **Gate 0 — baseline:** consented 30+ recordings per direction, real Sarvam outputs, stage timestamps, critical error ledger, device route labeled.
- **Gate 1 — translation:** IndicTrans2 must provide at least comparable critical-fact preservation and useful latency at batch=1/interactive, as judged by bilingual reviewers. Do not promote on BLEU/chrF alone.
- **Gate 2 — voice:** Maya must produce understandable Telugu/English on real text, no audible truncation/stalls, and meet realistic first-audio / completion targets under test load.
- **Gate 3 — live integration:** same-room, original audio retention, consent revoke, no feedback loops, explicit fallback, latency p50/p95 measured on phones/laptops.
- **Gate 4 — beta:** stability, license approval, privacy/security controls, capacity/cost ceiling, rollback and regression pass.

## Language-routing principle
A *room* has multiple speaking/listening preferences. A *translation job* is keyed by `(speakerId, segmentId, sourceLanguage, targetLanguage, engineVersion)`; computed results can be fanned out to multiple authorized listeners with the same target, after checking privacy/consent. Voice synthesis may still differ per selected output voice, so cache it separately by voice and settings.

## Model selector policy
The UI must not show arbitrary unsupported language pairs. The **internal lab** should offer `Sarvam Standard`, `Self-hosted IndicTrans2 translation`, `Self-hosted Maya voice`, `Self-hosted combined (experimental)` only when healthy/capable and provisioned. General user UI continues showing simple language preferences. A new engine selection starts at a clean segment boundary; do not splice already emitted audio mid-word. Record exact engine versions in each test result.

## Roadmap priority
1. Test baseline first.
2. GPU translation-only experiment.
3. Comparative review and token/phrase segmentation optimization.
4. GPU TTS-only experiment.
5. Internal translation lab selector + replay harness.
6. Real room feature-flagged integration.
7. ASR experiment and optional larger MT checkpoint.
8. Public beta only after acceptance.
