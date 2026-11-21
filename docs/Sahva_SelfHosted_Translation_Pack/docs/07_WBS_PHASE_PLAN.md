# 07 — Implementation WBS and phased development plan

## Rule
Update these tickets against **actual current repo** after reading all accepted ADRs and latest `PROJECT_SUMMARY.md`. Historical phase numbering from the buildathon should remain intact; self-hosted work uses new `GPU-`/`LAB-` prefixes. Each ticket delivers an observable vertical slice, not just a layer of code.

| ID | Prio | Task | Depends on | Acceptance / demonstration | Evidence |
| --- | --- | --- | --- | --- | --- |
| GPU-00 | P0 | Repo preflight, ADR, docs reconciliation | none | current branch/status, provider code, deployment and test harness verified, no conflicting work | docs + phase log |
| LAB-01 | P0 | Freeze Sarvam baseline | GPU-00 | same WAV hashes, current metrics, both directions, 30+ samples/direction target | JSON/CSV + reviewer |
| GPU-01 | P0 | Provision time-boxed 24GB worker | GPU-00 | quota, region, auth, model cache, health, spending alert, teardown | deploy receipt + invoice limit |
| GPU-02 | P0 | IndicTrans2 both directions worker | GPU-01 | true te↔en translation, pinned model SHA, proper processor and input validation | test text and latency |
| LAB-02 | P0 | MT-only A/B harness | LAB-01,GPU-02 | same gold source transcript to Sarvam and IndicTrans2; blind A/B, critical slots | reports + reviewer |
| GPU-03 | P1 | Stage adapter and feature flag in Node | GPU-02,LAB-02 | in a test room, a finalized turn gets MT from GPU without touching LiveKit or persistence semantics | E2E + rollback |
| GPU-04 | P1 | Stable segment scheduler experiments | LAB-01 | coherent phrase commit, no repeated speech, bounded queue, measured latency | test conversations |
| GPU-05 | P1 | Maya TTS worker | GPU-01 | pinned Maya revision, streamed target audio, independent output from same text, no clipping/stalls | audio + benchmark |
| LAB-03 | P1 | TTS-only comparison | GPU-05,LAB-01 | same target text to Bulbul vs Maya, blind listening and TTS timing | CSV/review |
| LAB-04 | P1 | Translation Lab model dropdown UI | LAB-02,GPU-03 | healthy compatible self-hosted engine appears, unsupported combos hidden, real results shown | browser test |
| GPU-06 | P2 | Async TTS chunk playback | GPU-05,GPU-04 | chunk stream queue respects cancellation/consent, no loops, source provenance retained | LiveKit two devices |
| GPU-07 | P2 | IndicConformer ASR experiment | LAB-01 | same recordings through Sarvam and IndicConformer, ASR-only evaluation | WER/CER/critical |
| GPU-08 | P2 | Bodhan MT research & license approval | LAB-02,GPU-01 | written license evaluation, HF access, separate 24GB run, no co-location assumptions | audit + test |
| GPU-09 | P2 | Combined engine test in isolated room | GPU-03,GPU-06 | both directions, transcripts, voice, consent, reports, fallback | production-like E2E |
| GPU-10 | P2 | Capacity/security/cost soak | GPU-09 | load, memory, p95 delay, timeouts, cost, network auth | metrics + runbook |
| GPU-11 | P3 | Beta release decision | GPU-10,LAB-04 | explicit signoff + no regression vs Sarvam | ADR Accepted or Rejected |
| GPU-12 | P3 | Commercial licensing/retention review | GPU-08 | all model/dependency restrictions resolved | record |

## Suggested execution phases

### Phase A — Baseline + docs (first session)
Read code/docs, run `scripts/compare-directions.ts` unchanged on consented fixtures, create test corpus metadata and engine capability registry proposal. **Do not spend on GPU yet** until baseline data and scope are clear.

### Phase B — Translation GPU proof (next session)
Provision time-boxed worker with a reproducible image. Load two IndicTrans2 distilled checkpoints. Run MT-only gold-transcript comparisons on real Telugu + English. Measure performance and quality. Document whether it beats Sarvam anywhere.

### Phase C — Bench and dropdown
Wire a stage-level provider adapter to the existing test harness and internal lab. Prove correct filtering of source/target and engine readiness, same fixture comparability, original media playback and errors. Keep production Sarvam selected.

### Phase D — Streaming voice
Host Maya independently, test streaming TTS, audio decoding, latency and naturalness. Attach only if measured improvement without clipping and enough memory. Then optionally try stable-prefix scheduling on live tracks.

### Phase E — ASR and larger MT experiments
Only if error attribution warrants it: test IndicConformer and Bodhan ASR on identical clips; run Bodhan MT with license access and its recommended prompts. Tune one variable at a time.

### Phase F — Test-room integration and decision
Use existing LiveKit meeting room behind feature flag; test 2-3 speakers, two listener languages, consent, reconnect, echo, source evidence and report invariants. Generate scorecard and explicit go/no-go recommendation. Promotion is a separate approved release.

## Constraints
- Continue the existing repo's project summary and phase templates. Do not rewrite history.
- Freeze model revisions for comparisons; a model-updated experiment starts a new run.
- No new public endpoints for unauthenticated model inference.
- Retain current production fallback and avoid concurrent working-tree conflicts.
- Deploying billed resources, production model changes and new storage policies require approval.

## Definition of done
Code and docs agree; typecheck/lint/unit/E2E pass; real provider/hardware run exists where claimed; test artifacts show timings and failures; known limitations listed; release behavior is reversible; `PROJECT_SUMMARY.md` appended with accurate branch, commits and next task.
