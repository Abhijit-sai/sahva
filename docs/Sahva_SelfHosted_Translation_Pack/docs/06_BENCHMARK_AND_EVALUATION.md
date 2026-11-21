# 06 — Benchmark, quality evaluation and lab workflow

## Question
Does a self-hosted model improve **Telugu ↔ English** (and later Hindi ↔ English) meaning accuracy or user-perceived delay over Sahva's production Sarvam pipeline, without breaking the room, recordings, voice quality and cost constraints?

Do not select a model based solely on public research scores. Different models are often evaluated on incompatible languages, audio conditions and hardware.

## Current harness reality
At inspected GitHub SHA `3655e76`, `scripts/compare-directions.ts` reads `telugu.wav` and `english.wav` in a fixture folder, normalizes both through ffmpeg to 16kHz mono, hashes source audio, compares **Sarvam batch vs Sarvam streaming** processing, writes original/base/stream WAV and `review.json` with stage latency. It requires `--consented` and `SARVAM_API_KEY`. There is **not** a generalized provider dropdown in this checked revision. Verify local changes before implementing new components.

**Reuse**: audio fixtures, hashing, PCM real-time pacing, isolated per-direction trials, output artifacts, private `.sahva/` test dir, human-review field.

**Add**: engine registry, model-specific stage adapters, runner matrix, model-version/config metadata, normalized metrics, blinded review UI, private test fixture list and concurrency accounting.

## Benchmark dataset
Start with **at least 30 consented clips per direction** for Telugu↔English (60 total). Expand to 100+ if the first pass is inconclusive. Include 5–15 second clips and several 20–30 second clips, 2+ fluent speakers per language if possible, and real phone/laptop recordings plus studio synthetic controls.

Coverage strata:
- Natural everyday conversation and questions.
- Telugu/English code-switching, Romanized terms, compound names, addresses.
- Negative/conditional phrases ("do not", "unless", "won't"), quantities, dates, currency and decimals.
- Short/choppy fragments, disfluency, interruptions, emotional/urgent turns.
- Noisy room, phone mic, headphones and speakerphone echo.
- Monologue/presentation speech and conversational turn-taking.

Annotate **original source transcript** and **gold human translation** separately, with critical semantic slots: person, date, quantity, currency, negation, actor, certainty. Do not evaluate model output against its own automatic transcript as ground truth.

Use opt-in voice content, remove personally identifying examples if they aren't necessary, and respect recording consent and retention. Do not reuse production customer data without authorization.

## Four controlled test modes

### E1 — Translation-only (highest immediate value)
- Use **one human-corrected transcript** per source clip as input for Sarvam Mayura, IndicTrans2, optionally Bodhan MT.
- Compare meaning quality, proper nouns/terms and *translation-only* latency. Disentangles MT from STT.

### E2 — ASR-only
- Same original recording into Sarvam Saaras, IndicConformer, optionally Indic-Transcribe; compare human reference transcripts, critical word error, code-switching and latency. No MT/TTS.

### E3 — TTS-only
- Same **human-verified target text** into Bulbul and Maya. Compare voice naturalness, pronunciation, p50/p95 time to first audio, completion, stalls and loudness. Voice identity separately only with consent.

### E4 — Full live conversation
- Same source recording paced as real-time frames to `Sarvam`, `Sarvam+IndicTrans2`, and `Sarvam+bestMT+Maya` (or qualified model); compare first meaningful audible translated audio, time after source phrase ends, error rate, queueing and overlapping speakers. Do not count offline file processing as live timing.

## Metrics (named precisely)

| Family | Metric | Computation / principle |
| --- | --- | --- |
| ASR | WER and Indic-aware CER | Human reference vs ASR; note script/normalization policy |
| MT | chrF++ / optionally COMET | Human target reference; compare both directions separately |
| MT critical | critical slot preservation | Human labels for negation, name, number, date, unit, certainty |
| Speaker | attribution accuracy | correct captured track and evidence turn |
| TTS | time to first *decodable* audio | text accepted to first playable audio from worker |
| TTS | playback stall rate | segments starved after playback starts |
| UX latency | source onset → first meaningful translated audio | timestamp capture across client/server clocks carefully |
| UX latency | source phrase end → first audible translation | key metric of wait after a phrase |
| UX latency | phrase end → end of translated playback | determines when reply is natural |
| Reliability | failure, retry, OOM, incomplete delivery | p50/p95, warm vs cold, queue under load |
| Resource | GPU peak VRAM, active seconds, $/successful translated minute | include idle/egress and call concurrency |

Use monotonic clock on the same host; for client/server samples, exchange clock alignment or measure spans within individual nodes and report measurement uncertainty. Per-stage network timing and queue timing must not disappear into a single number.

## Reviewer process
- Blind model identity, randomize presentation order, listen on headphones.
- At least two fluent reviewers for directional quality (more if results close). Flag disagreements and resolve; no invented scores.
- Each review: **meaning correct**, **critical facts intact**, **naturalness 1–5**, **pronunciation 1–5**, **unintelligible segment**, **notes**.
- Severe error category: reversed negation, wrong monetary amount, wrong date/unit, dangerous omitted instruction, or invented agreement. Count and inspect individually.
- LLM judge is supplementary; never sole judge. Track results by direction, noise condition and accent.

## Proposed promotion gates (calibrate with real baseline)
- **Block** any engine with a worse severe-error count than the baseline on the curated critical test set unless the difference is fully explained and resolved. Do not require the impossible claim of zero errors in unseen speech.
- **Consider** improvement only if human pairwise preference favors new output and neither critical errors nor tail latency regress materially.
- **Target**, not promise: p50 end-of-utterance→first audio under 2s and p95 under 4s on warm server with good connectivity. If missed, publish actual latency. For group calls, throughput/queueing needs a distinct acceptance target.
- No adoption without end-to-end consent, source replay, report provenance, reconnect and feedback-loop tests.

## Expected output format
Each benchmark invocation stores a private run directory:

```text
.sahva/benchmarks/<run-id>/
  manifest.json       # consent reference, audio hash, labels, model SHA, config
  base-original.wav    # authorized local fixture, not published
  references.json      # human source/target, critical slots
  engine-A.json        # measured stage output / timing / errors
  engine-B.json
  engine-A-target.wav  # when TTS used
  engine-B-target.wav
  review-blinded.csv   # no vendor shown to reviewer
  decision.md          # scored results, caveats, ship/no-ship
```

Do not commit private audio or credentials. Public test samples require appropriate licensing/consent and sanitization.

## Dropdown / UI behavior
- Add internal `Translation Lab` with three selectors: **stage** (`Whole Pipeline`, `MT only`, `TTS only`, `ASR only`), **source/target language**, and **eligible engine(s)**. Engines only become selectable if the capability registry says they are compatible **and healthy**.
- Provide `Run same recording` button, progress per job, source playback and target A/B playback. Expose model revision, warm/cold, timing, errors and reviewer form.
- Existing live-room language selectors remain; optionally add **Advanced → Experimental translation engine** only to developer/test users. Avoid switching engine in middle of already spoken segment.
- Compare raw translated text and human references; don't let TTS naturalness overshadow translation correctness.
- Explicitly label results as `baseline`, `experimental`, `unsupported`, `failed`, or `not yet tested`.

## Harness implementation tickets
`LAB-01`: refactor existing script into shared-fixture loader, normalized metric schema, Sarvam adapter; output unchanged baseline. `LAB-02`: configurable model capabilities and health gating. `LAB-03`: IndicTrans2 stage adapter, API auth. `LAB-04`: MT-only A/B UI and reviewer. `LAB-05`: TTS and ASR adapters. `LAB-06`: real-time paced compare and group fanout. `LAB-07`: release and safety checks.
