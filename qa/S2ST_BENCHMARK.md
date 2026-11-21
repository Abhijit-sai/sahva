# Direct speech translation trial · 21 November 2026

**Decision: retain Sarvam in Sahva.** The dedicated Google model streamed both ways, including when the speakers overlapped. Gemini started translated playback earlier on every matched recording. Material changes to quantities, instructions and question intent failed the accuracy gate. The trial ran outside the public meeting. [Proposed ADR](../docs/adr/0006_gemini_live_translate.md)

## Paired results

Five unique synthetic clips per direction, one concurrent two-channel run per engine and scenario. Values are medians in seconds. Negative post-speech delay means the listener's queue reached the first voiced translated sample while the source was still speaking.

| Source → target | Engine | First source caption from onset | First voiced playback from onset | First voiced playback from end of source | Last voiced playback from end of source |
| --- | --- | ---: | ---: | ---: | ---: |
| Telugu → English | Gemini | 2.81 | 3.12 | −2.94 | 3.22 |
| Telugu → English | Sarvam | 1.16 | 9.08 | +3.79 | 8.48 |
| English → Telugu | Gemini | 2.77 | 3.06 | −3.49 | 3.24 |
| English → Telugu | Sarvam | 1.13 | 9.32 | +4.33 | 10.72 |

Median within-recording gain in first playback was 6.05 s for Telugu input and 6.22 s for English input. All ten Gemini streams started voiced playback before source end. Sarvam also did so on both pause fixtures, where the first phrase finalized while the next was spoken. Ten distinct recordings are too few for a useful per-direction p95.

Both engines received the same 16 kHz source samples at real-time speed. The matcher recomputes each original PCM SHA-256. Sarvam used the released room functions for stream acquisition, drafts, archive, translation, synthesis and authorized delivery with embedded PostgreSQL and private local files. Gemini had an open session when speech started (275–620 ms setup). Sarvam opened ASR on voice activity, as in the room. Both used the same Chrome Web Audio sink. Results exclude public LiveKit transport, production database latency, timeline polling, device speakers and the listener's comprehension time. Speech boundaries use 10 ms RMS windows above the meeting's energy threshold. Leading silence, returned PCM, browser scheduling and browser ended events are recorded separately.

## Meaning, expression and stability

| Scenario | Observations from the matched runs |
| --- | --- |
| Pickup and revised plan | Gemini's English translation introduced a calendar date, Monday the 20th, from a quantity of twenty cartons. The quantity itself survived in the paired run and disappeared in an earlier single-speaker run. Sarvam retained the quantity without introducing a date. |
| Names, locations, negation and correction | Gemini's English source transcript correctly recognized 15. Its Telugu output said 50 while preserving the correction to 12. Independent ASR of the original and generated WAVs returned 15 and 50 respectively. Sarvam preserved 15, the prohibition and 12. |
| Currency, date, business terminology and question | Both paths retained Hyderabad, ₹25,000 and June 15 on Telugu input. Gemini's English transcript turned a question about finishing the update into a prediction. Independent ASR of the English output also rendered it as a statement. A listener still needs to assess the intonation. |
| Pause, urgency and sequencing | Following a one-second inserted pause, Gemini reversed the dependency between a backup and restarting the database. Independent English ASR recovered the reversed clause, cutting off its last word. Sarvam retained the prohibition but mistranslated the backup wording. On English input Gemini added a name and changed “database” to “computer.” |
| Code-switching | The Telugu/English release instruction lost the speaker's intended name, QA sign-off and deployment action in Gemini's English text. Sarvam retained the action and QA condition with a name error. In the reverse direction Gemini retained “tomorrow” and dropped “morning.” Mixed speech also produced a Marathi source-language event. |

These are spot checks against the fictional fixture text and recorded output. There was no blinded human listening panel. Perceived intelligibility, pitch, urgency, naturalness, voice similarity and speakerphone echo remain unscored. The two speakers had independent source buffers, sockets, transcript journals, pages and playback queues. Neither fixture nor output graph routed a translated stream back into the capture input.

All ten paired Gemini trials returned both transcripts and decodable output audio. None supplied an explicit finished transcript or turn-complete signal in the recorded journal. Keep original evidence and a separate finalization strategy before using this text in a report. One forced disconnect stopped just the Telugu stream and produced an explicit partial failure. Its English peer completed and both directions opened successfully in later sessions. Seamless in-session resumption and quota saturation remain unverified. In the playback-stop trial each listener discarded three queued buffers while input continued. This tests local stop behavior. Conversational barge-in still needs two people.

Initially the harness waited for a packet-free interval. Gemini kept emitting silent PCM after both translations had finished and the trials timed out. The measured runs stopped after input ended and 4.5 seconds elapsed without voiced audio or transcript content, within a bounded drain period. This heuristic is suitable for these short fixtures. It cannot certify a final translation across arbitrary pauses.

## Cost

For the ten paired Gemini trials, 79.79 seconds of submitted audio including trailing silence and 111.50 seconds of returned audio imply **about US$0.066** at the posted paid audio rates and 25 tokens/second. Google supplied repeated usage events. The estimate uses byte duration and published rates. Actual billed tokens, free-tier treatment and invoice totals remain unknown. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing)

Using 65.79 seconds of source audio, 857 final source characters and 926 synthesized characters gives **about ₹4.10 before draft translations** for the ten Sarvam recordings. This approximation excludes phrase padding, retries, file transcription fallback, storage and transport. It uses ₹0.49/ASR minute, ₹2/1,000 MT characters and ₹2/1,000 Bulbul v4 Flash characters. Fixture creation, diagnostic retranscription and auxiliary trials are outside both estimates. [Sarvam pricing](https://docs.sarvam.ai/api/getting-started/pricing)

## Reproduction and evidence

Run from the repository root using Node 22.13+, installed project dependencies, FFmpeg and Chrome. Keep `GEMINI_API_KEY` and `SARVAM_API_KEY` in the ignored local environment. Optional `GEMINI_LIVE_MODEL` must match `gemini-3.5-live-translate-preview`. No key or provider socket is passed to the browser. All output goes into a fresh ignored `.sahva/s2st-*` directory.

```powershell
# Existing fictional fixtures in this checkout. Each directory has english.wav and telugu.wav.
node --env-file=.env.local --experimental-strip-types scripts/s2st/run.ts gemini te .sahva/synthetic-inputs-WwRqjn --consented
node --env-file=.env.local --experimental-strip-types scripts/s2st/run.ts gemini en .sahva/synthetic-inputs-WwRqjn --consented
node --env-file=.env.local --experimental-strip-types scripts/s2st/run.ts gemini both .sahva/synthetic-inputs-WwRqjn --consented
node --env-file=.env.local --experimental-strip-types scripts/s2st/run.ts sarvam both .sahva/synthetic-inputs-WwRqjn --consented
```

For a fresh checkout, `scripts/synthetic-speech-proof.ts` generates the pickup pair and runs the existing paid-provider smoke test. `node --env-file=.env.local --experimental-strip-types scripts/s2st/fixtures.ts --synthetic` generates the other four scenario directories. Record their paths once and reuse the exact WAVs across engines. To measure interruption append `--interrupt`. For the explicit one-channel failure test append `--disconnect-te` to the Gemini two-channel command and expect a nonzero exit.

For a single consenting speaker wearing headphones, substitute `mic` for the fixture directory and choose a single Gemini source language. The local browser button enables a 25-second capture window using Sahva's AudioWorklet. Source and translated text appear alongside progressive playback. A file-backed Chrome microphone can exercise this same path with `--fixture-mic` and a fixture directory. Two independent fake-device tests passed. Real hardware and human voice identity require separate consent and review.

| Fixture | Gemini private run | Sarvam private run |
| --- | --- | --- |
| Pickup and revised plan | 4aKaMN | LPJkAd |
| Names and correction | Xhiybp | 2s3tWk |
| Business and date | SYQa03 | VLHOZr |
| Pause and urgency | aeziJ7 | zXR0LK |
| Mixed languages | B6WPLV | Rg4lvu |

Each identifier resolves to `.sahva/s2st-<id>/<en or te>/`. Inspect `review.json`, `original.wav` and translated WAVs there. Three Gemini directories also have `cross-check.json` with independent ASR of the source and translation. Run the aggregate comparison offline with alternating Gemini and Sarvam directories.

```powershell
node --experimental-strip-types scripts/s2st/compare.ts .sahva/s2st-4aKaMN .sahva/s2st-LPJkAd .sahva/s2st-Xhiybp .sahva/s2st-2s3tWk .sahva/s2st-SYQa03 .sahva/s2st-VLHOZr .sahva/s2st-aeziJ7 .sahva/s2st-zXR0LK .sahva/s2st-B6WPLV .sahva/s2st-Rg4lvu
```


## Try your own microphone locally

From the repository root run `node --env-file=.env.local --experimental-strip-types scripts/s2st/demo.ts` and open [the listening demo](http://127.0.0.1:19752/). Choose the speaking direction, use headphones, and press **Start trial**. Grant microphone access and speak when the page says **Listening**. **Finish speaking** releases the microphone and lets Gemini finish its output. **Cancel** ends the trial immediately. Each capture is limited to 25 seconds.

Listen as you speak, compare the source and translated captions, then use **Replay translation**. The timing display estimates the interval between detected microphone speech and the first voiced sample scheduled for browser playback. Trials stay in browser memory and the local process sends the microphone audio to the configured Gemini service. The page opens idle. Only one trial can use this loopback server at a time.

## First listener feedback and local language-hint trial

The operator spoke Telugu with Telugu → English selected. Two screenshots showed Hindi and Vietnamese source captions. The old heading echoed the selected direction. For English → Telugu, the operator judged the result better but below Sahva's quality bar. In the supplied example the translated caption retained the target change from one million to two million and omitted the final Telugu question about the financial year's revenue. The screenshots document captions. The original human audio was unavailable for replay.

The local demo now sends the chosen language in inputAudioTranscription.languageCodes and a setup-time translation instruction. It requests echoTargetLanguage for mixed utterances and displays language codes reported by Gemini. A third-language report produces a visible notice. A language hint can bias both recognition and the reported code. The original standalone benchmark configuration is preserved. [Live API transcription configuration](https://aistudio.google.com/api-reference/live#AudioTranscriptionConfig) · [Live Translate configuration](https://aistudio.google.com/docs/live-api/live-translate.md)

The dedicated preview accepted the settings. On a synthetic Telugu business question it reported Telugu and returned English speech. On identical English-then-Telugu recordings, with the English hint held fixed, both echo settings included the Telugu question in the translated captions. Both reported English for the mixed source and changed fifteen boxes to fifty. This pair does not establish that echo suppression caused the user's omission or that the changes fixed accuracy. Private synthetic evidence is in .sahva/s2st-lang-vir44i. Keep Sarvam in production.

## Quarter comparisons · local prompt A/B

The English → Telugu listening demo now adds this instruction to its existing source-language guidance: “Preserve which reporting period is being compared with which. Keep each figure attached to its period. Use natural spoken Telugu for a business meeting.” The standalone control kept the previous hint and target-language echo. The unmodified production Sarvam meeting path was outside this trial.

Four synthetic English recordings reconstruct the quarter example. Two explicitly name both quarters and reverse which did better. Two use “this one” or “the last one.” All also describe a one-million target this month, ten percent growth last month, and failure to reach the minimum. The original human audio was unavailable. Each paired session received identical normalized PCM, framing and end signaling. The explicit recordings each had three paired repetitions. The pronoun recordings each had one. Independent ASR confirmed the complete English source in all four files. The eight pairs yielded sixteen Telugu audio files. The evaluator reviewed the translated captions and separate ASR of the generated speech under randomized x/y labels, then saved grades before reading the assignments.

| Measure | Existing prompt | Added instruction |
| --- | ---: | ---: |
| Comparison direction clear in context | 7/8 | 7/8 |
| Both figures attached to the correct months | 8/8 | 8/8 |
| Final minimum-target negation complete in translated caption | 2/8 | 4/8 |
| Pairs preferred for Telugu wording of comparison and figures | 3 | 1 |

Four pairs tied on wording. All six explicit comparisons per arm preserved the direction. On the prior-quarter-better pronoun clip both produced “నా చివరి త్రైమాసిక ఫలితాలు దీనికంటే చాలా మెరుగ్గా ఉన్నాయి.” The listener still has to resolve “last/final” and “this one.” Neither output inverted the comparison. Several trials dropped the end of the last clause, sometimes already in the Gemini source caption. Independent ASR of the output corroborated the comparisons and figures but often ended before the negation even when the translated caption included it. The 4/8 and 2/8 counts apply to caption completeness only. Natural phrasing was a single evaluator’s textual judgment. Vocal quality and human preference remain open.

The instruction remains enabled locally as requested. This small test gave no measurable quarter-accuracy advantage. Percentage or corpus-level accuracy claims would require more independent recordings.

Reproduce from the repo root with `node --env-file=.env.local --experimental-strip-types scripts/s2st/quarter-ab.ts --synthetic` and repeat with `--pronoun`. Private evidence in `.sahva/quarter-ab-yplmsT` (explicit) and `.sahva/quarter-ab-GMSvPl` (pronoun) contains the sources, SHA-256 hashes, Telugu WAVs, transcripts, blind grades and assignment keys.

## End-of-speech replay on the same quarter recordings

Replayed all four saved synthetic English WAVs from the previous experiment, twice each. The runner verified their decoded PCM hashes before sending them. Both quarter comparison directions and both explicit and pronoun phrasings were represented. Every recording ended with “But we did not even reach the bare minimum.” The reporting-period prompt, input language hint, model and output language were fixed. The files already contained 130–170 ms of trailing quiet after the last detected speech.

Each pair opened two independent real Gemini sessions. One signaled end at file EOF. The other sent four more seconds of paced, silent 16 kHz PCM before signaling end. On each response we captured the audio and captions at both 4.5 and 8 seconds of quiet after end, with hard limits of 15 and 20 seconds respectively. These nested observations let us test a longer wait on the exact same output. Sarvam ASR independently transcribed the rendered Telugu. A pass required an explicit failure to reach the minimum in the spoken-output transcript. No human listener score was collected.

| Input ending | Quiet cutoff | Negation in audio | Negation in caption | Median last Telugu playback after English stopped | Median trial completion after English stopped |
| --- | ---: | ---: | ---: | ---: | ---: |
| End at EOF | 4.5 s | 0/8 | 0/8 | 1.58 s | 5.75 s |
| End at EOF | 8 s | 0/8 | 0/8 | 1.58 s | 9.25 s |
| 4 s of silence before end | 4.5 s | 8/8 | 8/8 | 3.92 s | 8.71 s |
| 4 s of silence before end | 8 s | 8/8 | 8/8 | 3.92 s | 12.22 s |

The silence-before-end policy added a median **2.48 s** to the last scheduled voiced playback within matched pairs (range 1.36–3.53 s) and **2.95 s** to trial completion. The two quiet cutoffs yielded identical speech WAV hashes and captions within all 16 sessions. A longer wait after the end signal added no speech. On the explicit previous-quarter-better clip in round one, immediate end yielded an unfinished “కానీ మేము కనీసం” in the independent audio transcript. With silence it yielded “కానీ మేము కనీస స్థాయిని కూడా చేరుకోలేకపోయాము.” The shorter playback in the control omitted meaning. Timing uses 10 ms energy windows and Chrome's playback schedule. Device speaker latency and subjective quality require listening tests.

English → Telugu in the loopback demo now sends four seconds of server-generated silence when microphone input finishes. The local page also displays the delay from the last detected input speech to the last scheduled translated speech. A separate Chrome smoke test exercised Finish speaking on a synthetic microphone with the previous-quarter recording. It verified zero live microphone tracks after the click, trial completion, replay and the timing display. The caption included the complete negation and the displayed delay was **4.22 s**. The decision applies only to this local experiment and this translation direction. The next comparison is shorter silence on the same fixtures plus consented human recordings.

Reproduce with `node --env-file=.env.local --experimental-strip-types scripts/s2st/ending-ab.ts .sahva/quarter-ab-yplmsT .sahva/quarter-ab-GMSvPl`. Private evidence in `.sahva/ending-ab-lrtCOh` includes each cutoff's WAV, input and output hashes, both transcripts and playback and completion timings.

## Exact-input follow-up · no generated silence in normal trials

Replayed the four verified quarter recordings twice each per condition. Both arms streamed all and only the decoded 16 kHz PCM, including each file’s original pauses. The SHA-256 of the samples submitted to the Gemini adapter matched the independently saved fixture hash in all 16 sessions. One arm sent the end signal at EOF. The other held the connection open for four seconds after EOF without sending any packets, then sent the signal. Neither arm produced a complete spoken negation (0/8 in each according to independent Telugu ASR). Gemini’s own English caption omitted the word “minimum” in all 16. Waiting for eight seconds of quiet after the signal gave the same spoken output and captions as waiting for 4.5 seconds in each session. These observations locate a failure after the client submitted the audio. They do not identify Google's internal cause.

Context can also change before the ending. For the pronoun previous-quarter recording, round one, four-second idle arm, the input caption correctly said the increase of ten percent was last month. Both the Telugu caption and independent ASR attached the increase to this month. In the earlier padded replay, “this month” for the target also became the less specific “this time” in some responses. The earlier 8/8 score covered only the final negative clause.

The local demo now sends the actual final partial microphone packet before signaling end, with no input padding in either direction. The old capture path could discard less than one 200 ms packet on Finish. The prerecorded trials bypassed microphone capture and did not have that issue. The quarter prompt runner and standard comparison runner also use exact input by default (historical runs included 1.0 s and 1.4 s of padding, respectively). Generated pauses inside planned synthetic fixtures remain part of those recordings. For the earlier four-second padding experiment only, the historical reproduction command now requires the explicit first argument `--padded-control`. The same command without that argument reproduces the exact-input experiment. Output files used for independent ASR include 0.7 seconds of trailing quiet after the last detected output speech. This is downstream of Gemini.

Private evidence in `.sahva/ending-ab-V3JgkR` includes per-session input and sent PCM hashes, both providers’ transcripts and output WAVs. Chrome checked the local Finish and replay flow on a file-backed microphone. The displayed end delay was 2.09 s and the translated caption again cut off after “కానీ మేము కనీస”. The worklet regression verifies exact sample order and count for six lengths including an empty capture, a final single sample and a partial final packet.

## Local multi-provider comparison

Start the loopback lab with `npm run lab:translate` and open http://127.0.0.1:19752/. Starting this separate process is the local opt-in. Use the same server-side keys as the project, with optional Alibaba workspace variables listed in .env.example. Reload the demo process after configuring credentials. A source/target choice filters engines. Switching the model preserves the requested languages. A failed engine records an error and requires explicit selection of another. Group routing is proposed in ADR-0007. The operator requested the listening demo as the first test surface.

Select a saved synthetic recording or upload a consented audio file. For a personal trial, start with Live microphone, finish speaking, select Last microphone recording, then choose the comparison engines. The page decodes once, replays identical 16 kHz mono PCM at the source pace, passes the final partial packet and inserts zero input padding. OpenAI requires duration-preserving 24 kHz conversion. Identical decoded PCM is identified by SHA-256. Original/translated players, per-engine captions, failures, browser receipt and scheduled playback metrics appear under Recording comparison. Save results and review exports JSON with model, settings, hash, timestamps, metrics and separate human grades. Browser-held recordings are lost on refresh. Sarvam's existing local baseline harness also saves its test-room evidence under ignored .sahva. The lab binds to loopback with an exact Origin/Host check before provider access.

### Corrections fixture · first provider run

The Telugu, Hindi and English recordings describe a shipment for Anusha to Vijayawada. Do not send 15 boxes. Send only 12. Hindi audio is synthetic Bulbul v4 Flash. One rendering per direction and engine. Below are source onset to first voiced chunk arriving at the CLI, or first returned synthesis WAV for Sarvam. These exclude session setup and browser playback. Quality observations are a reading of the target captions and require a fluent listening review.

| Direction | Sarvam | Gemini | OpenAI |
| --- | --- | --- | --- |
| Telugu → English | 8.26 s, preserved name, city, refusal and 12 | 3.01 s, stopped at “Only send” | 4.09 s, correct numbers and instruction, rendered Anusha as “Anasu” |
| English → Telugu | 8.32 s, caption retains the name, city, 15 and 12 | 2.98 s, rendered 15 as 50, shortened the destination and omitted the final quantity | Unsupported speech output |
| Hindi → English | Outside current baseline adapter | 3.19 s, retained 15 and city, omitted send-only-12 | 4.84 s, converted the first instruction into “He sold fifteen boxes”, retained 12 |
| English → Hindi | Outside current baseline adapter | 3.07 s, rendered 15 as 50 and shortened the destination | 4.20 s, caption preserved the name, city and both quantities |

Private trace files are `.sahva/model-lab-*/result.json` with output WAVs alongside. The additional Chrome replay of the same English PCM (SHA prefix 86596f23969f) scheduled first audible Hindi at 3.03 s for Gemini and 4.00 s for OpenAI. End of source speech to last voiced playback was 2.37 s and 3.08 s respectively. These are browser Web Audio schedule estimates; no LiveKit transit or hardware acoustic delay is included. No fluent human quality scoring yet. The Playwright test exercises exporting a dummy review only.

Reproduce a single rate-paced receipt with `node --env-file=.env.local --experimental-strip-types scripts/s2st/lab-probe.ts openai te en .sahva/s2st-fixtures-PNJDiM/corrections/telugu.wav --consented`. Use an existing generated fixture directory or run `scripts/s2st/fixtures.ts --synthetic` under the same Node flags first. Run `scripts/s2st/hindi-fixture.ts --synthetic` once for the Hindi script. Fixture IDs are restricted to known fictional scenarios. The app offers names, quantities, corrections, business dates, mixed language, pauses and longer quarter comparisons when their recordings exist. Accent diversity, spontaneous interruption and emotional delivery need consented human recordings. Compare each direction separately and review result audio before rating.

## Stage-isolated MT evaluation · 21 November 2026

Collect recordings using [the bilingual recording sheet](RECORDING_SHEET.md). In a private directory under .sahva, keep original files plus the derived mono 16 kHz WAVs. `node scripts/s2st/prepare-mt-fixtures.ts PRIVATE_FOLDER` creates manifest.draft.json and hashes decoded PCM. Listen to each clip, correct the source and target, fill confirmedBy, referenceRevision, consentRecord and allowedProcessors, then save a reviewed manifest. Respect consent scope/expiry before every run. The sheet includes draft references only.

Run `node scripts/s2st/mt-compare.ts PRIVATE_MANIFEST validate` first. Use `node --env-file=.env.local scripts/s2st/mt-compare.ts PRIVATE_MANIFEST sarvam 3` for the Mayura reference and replace sarvam with paired after configuring the private endpoint. Only finalized text is sent. Private per-arm receipts retain failures. Give reviewers only the randomized review JSONs and original recordings. Score meaning (1–5), names, quantities, negations, omissions, question intent and invented commitments before opening the arm receipts. Concurrent app traffic, cold start, direction, failure counts and sample counts belong in each report. Percentiles in successful-mt-rtt.json use nearest rank on successful MT calls. Listening naturalness and end-to-audible delay need a separate paced audio trial.

Fresh real Sarvam smoke used the fictional corrections pair in .sahva/s2st-fixtures-PNJDiM. Private receipt directory .sahva/directions-0kJXX6 contains source and translated WAVs, exact hashes and actual text. Times below are milliseconds, one observation per direction.

| Source | Audio duration | Offline ASR | Mayura | Full Bulbul WAV | Offline total | Paced interim / final | Paced MT | First TTS payload | Paced completion from start |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Telugu | 5313 | 562 | 801 | 1225 | 2599 | 783 / 5704 | 964 | 220 | 7700 |
| English | 5440 | 406 | 867 | 1974 | 3249 | 1102 / 5762 | 821 | 377 | 7967 |

The paced driver observes server receipts. Browser decoding, playback and human accuracy were unobserved in this run. The private human-recording corpus still needs speaker-confirmed references.

### Repeats and browser playback

Two more runs on the same synthetic correction pair (.sahva/directions-nskGDg and .sahva/directions-UDh6Dc) matched both original hashes. Nearest-rank p50 and p95 below are milliseconds. At three trials of one utterance per direction, the p95 is the largest observation.

| Source | Offline ASR p50 / p95 | Offline MT p50 / p95 | Full TTS WAV p50 / p95 | Offline total p50 / p95 | Paced completion p50 / p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Telugu | 554 / 562 | 826 / 883 | 1224 / 1225 | 2599 / 2604 | 7611 / 7700 |
| English | 406 / 467 | 867 / 906 | 1920 / 1974 | 3073 / 3249 | 7967 / 8217 |

On the same PCM the local Chrome Standard adapter scheduled first voiced playback 2658 ms after detected Telugu speech ended and 3752 ms after English speech ended. First source captions arrived at 995 and 680 ms from onset respectively. Naturalness and hardware playback delay require listening. Both generated WAV downloads matched their exported SHA-256. Evidence in .sahva/mt-browser-rxNvXd includes original and generated WAVs, metrics and captions. Both text outputs preserved the corrected quantities. The batch English-to-Telugu second instruction was phrased as a fragment.

The importer reads original WAV or phone M4A files directly. It creates a fresh ignored .sahva/mt-fixtures-* directory containing paired WAVs for compare-directions.ts, original-file and decoded-PCM hashes, sample counts and a draft manifest. Retain originals and confirm the actual words before MT-only testing.

The updated compare-directions.ts also writes an offline receipt before starting the paced trial. A subsequent failure is retained per direction. The synthetic rerun in .sahva/directions-pajXIq verified source WAV, decoded PCM, batch output WAV and streamed WAV digests in both directions. Human starter input is under docs/Test_recordings and is excluded from source control and application image contexts. The first ten clips have a private playback and reference review at .sahva/mt-fixtures-15rJEs/review.html.

For later recording batches run `python scripts/s2st/fixture-review.py PRIVATE_FIXTURE_DIR` after import. Open review.html locally, listen to each clip, enter the verified source and target and download the checked references. The review export preserves the fixture hashes. Processor consent remains independently recorded.

## Oregon CPU translation trial · 21 November 2026

The existing MT harness tested the first five fictional scripts from the recording sheet in both directions. Each prompt ran three times per engine with randomized call order, yielding 60 successful requests, zero failures, and 30 blinded review files. Each provider received the same source-text digest for each prompt. Human scores are pending. No recordings were sent. This measures finalized text translation only.

| Direction | Engine | Requests | Client round trip p50 / p95 | Worker inference p50 / p95 |
| --- | --- | ---: | ---: | ---: |
| English → Telugu | Sarvam Mayura v1 | 15 | 702 / 853 ms | unavailable |
| English → Telugu | IndicTrans2 distilled | 15 | 994 / 1,182 ms | 704 / 893 ms |
| Telugu → English | Sarvam Mayura v1 | 15 | 743 / 826 ms | unavailable |
| Telugu → English | IndicTrans2 distilled | 15 | 681 / 735 ms | 403 / 464 ms |

In all three English → Telugu runs, the code-mixed instruction to hold a release contained a prohibitive verb in the source. IndicTrans2 produced “విడుదల చేస్కోండి.”, a positive instruction to release. Sarvam retained the prohibition but misread QA as a question-and-answer activity. In the reverse direction, IndicTrans2 kept the 150-rupee quantity and unit in all three price questions. Sarvam omitted the amount each time. These are engineering observations for bilingual adjudication. The repeat count describes timing and reproducibility. There were five distinct source texts per direction.

The Intel Xeon Platinum 8488C host had 8 vCPUs and 16 GiB RAM. The CPU FP32 worker reported four effective Torch threads with OMP/MKL requested at eight, five beams and batch size one. Worker-ready time was 19.97 s as observed by the operator, including SSH and polling. The worker cgroup recorded a 789,221,376-byte peak and 76.13 CPU-seconds. That memory counter excludes file pages charged to other cgroups and is unsuitable for sizing the whole host. Client timing includes the operator-to-Oregon SSH tunnel for IndicTrans2 and the client-to-provider network for Sarvam. These measurements do not include audio, ASR, TTS or listener playback.

The private receipts and blinded references are in `.sahva/mt-comparison-oTWob5/`. The EC2 startup and resource observations are in `.sahva/oregon-cpu-01/run.json`. Reproduce using the worker README. Keep the hybrid out of live rooms pending bilingual review, expanded code-mixed negation tests and consented audio evaluation.

## Maya and Bulbul preset-voice trial · 21 November 2026

Sahva submitted fictional recording-sheet text to Maya Research's Studio and the existing Bulbul v4 Flash streaming endpoint. The comparison reused the same UTF-8 text digest per pair. Sreekar was the Maya preset in both languages; Bulbul used Sahva’s English Simran and Telugu Pooja configuration. Normalization was enabled on Maya, with seed 42 for the matched pairs. No reference voice or microphone recording was submitted. Studio source was `1d9453d8e7cd5ab0a75eac44b623046847d9fce9`. The published model card revision was `87a83efdd6551e038246b6b37836a6264713eec3`; the hosted API does not return a loaded weight SHA. [Studio implementation](https://huggingface.co/spaces/maya-research/maya2-native-studio/blob/1d9453d8e7cd5ab0a75eac44b623046847d9fce9/app.py)

| Target / prompt 01 | Maya first decoded PCM / stream complete | Bulbul first decoded PCM / stream complete | Output length, Maya / Bulbul |
| --- | --- | --- | --- |
| English | 25,677 / 26,665 ms | 386 / 1,113 ms | 5.04 / 4.64 s |
| Telugu | 1,481 / 2,391 ms | 390 / 1,253 ms | 5.20 / 4.85 s |

Two repeats were planned for ten fictional texts. Bulbul completed 20/20. Maya completed the first matched pair in each language, then Studio returned a GPU quota error on the third request. The runner skipped the remaining 17 Maya calls. An earlier, separate English connectivity probe returned PCM and completed. Timings include provider queue and network from the client; startup, queue and model-only times cannot be separated. First PCM measures decodable audio at the client, prior to playback. Across ten Bulbul calls per language, first PCM p50/p95 was 211/386 ms in English and 325/390 ms in Telugu. The two Maya observations are insufficient for percentiles or self-host sizing.

Local file decoding, speech energy and WAV digests passed for both matched pairs. Offline Whisper-small on English reproduced the prohibition, 15 and 12 for both voices. With Telugu specified it emitted Devanagari for both, so those readings are unsuitable for Telugu pronunciation scoring. The private blind listening sheet lets a bilingual listener compare names, numbers, clarity, and pacing and export their preference. No human score has been recorded. Keep Bulbul as the default pending matched repeated trials and listener review.

The run is `.sahva/tts-comparison-F0KtYa/`, with `listening.html`, WAVs, timing receipts and separate machine readings. To repeat, run `node --env-file-if-exists=.env.local --experimental-strip-types scripts/s2st/tts-compare.ts --fictional 2` and then `python scripts/s2st/tts-listening.py PRIVATE_RESULT_DIR`. Passing a reviewed manifest instead of `--fictional` requires specific permission for both Bulbul and the public Maya Studio to receive target text. Generate the speaker review with `fixture-review.py`; its export records separate permissions for MT text, original speech, and TTS text.

### Blinded listener result · 21 November 2026

One listener reviewed both completed matched pairs. Maya Sreekar was preferred in English (B, against Bulbul Simran) for pacing and voice, and in Telugu (A, against Bulbul Pooja) for naturalness. Telugu Sreekar sounded slightly slow and Pooja sounded drawn out to this listener. Each preference covers one phrase per language. Prioritize Sreekar for the next listening round. Compare a second Telugu Bulbul preset before attributing the result to the engine. Production promotion still requires more phrases, listeners and representative serving latency. The original review is archived privately under the run’s human-reviews directory. The four WAV hashes and their paired text hashes matched the receipts.

## Speaker-confirmed recording benchmark · 21 November 2026

All ten originals matched their recorded digests. The speaker confirmed five English and five Telugu references, including processor permissions. Their verified text matched the earlier prompt wording. This adds real recorded speech and speaker confirmation to the earlier text cohort. It does not add ten new scripts.

| Source → target | Mayura RTT p50 / p95 | Local CPU IndicTrans2 RTT p50 / p95 |
| --- | --- | --- |
| English → Telugu | 719 / 883 ms | 797 / 1,205 ms |
| Telugu → English | 733 / 885 ms | 729 / 959 ms |

There were 15 calls per cell, three repeats per clip, 60 successful MT receipts overall. The private model used the previously pinned directional checkpoints in FP32. These round trips use a local worker and a remote Sarvam service. They describe this configuration. All ten recordings also completed both the Sarvam file baseline and an original-pace replay. Twenty synthesized WAV hashes were verified. The median wall time from the start of the paced pipeline to receipt of the full translated WAV, minus the decoded input duration, was 2,439 ms for English input and 2,154 ms for Telugu input. This includes connection overhead and excludes listener playback.

Engineering meaning review found that EN-04 reversed the release prohibition in all three IndicTrans2 trials from verified text; Mayura kept the hold while corrupting the addressee and the QA concept. TE-05 preserved the price with IndicTrans2 on all three runs; Mayura omitted it in all three. On the actual speech, recognition changed the price from 150 to 50 and both translators carried the error forward. TE-01 also showed changes to the name and shipment unit before translation. On EN-04, the recognizer turned QA into Q&A, after which the hybrid omitted the hold instruction. These observations support retaining Mayura as the default and testing recognition on names, quantities and code-switching. There is no aggregate human translation-quality score.

All ten verified target-text digests matched previous Bulbul samples and two matched completed Maya Studio samples. For the eight outstanding target texts, Bulbul succeeded on eight. Maya Studio rejected the first call for GPU quota and the remaining seven were skipped. The earlier blinded Sreekar preferences apply to the two matching clips. Keep Sreekar experimental until a larger voice and latency comparison is possible.

Private report, paired receipts and the staged comparison using the actual paced ASR are in `.sahva/mt-comparison-mWHqdD`. The ten audio pipeline receipts are indexed by their verified PCM digests in that directory’s `paced-inputs.json`. The outstanding TTS run is `.sahva/tts-comparison-fUr2IP`. Human references, raw transcripts, audio, reviewer identity and hearing notes remain in the private workspace.

## Three-language demo direction · 21 November 2026

An isolated provider smoke used one existing fictional shipment recording per source language (English, Telugu and Hindi), Saaras v4 with the speaking language specified, direct translation to each of the two other languages, and Bulbul v4 Flash. The Mayura baseline and the Sarvam Translate v1 candidate each produced six decodable WAVs with speech energy. The same three recognition receipts fed both translation arms. This was a file-based provider test; the public room still has an English/Telugu contract.

Saaras transcribed the Hindi shipment prohibition correctly. Mayura instructed the listener to send fifteen in both English and Telugu; Sarvam Translate v1 preserved the prohibition and the correction to twelve, while rendering boxes as containers. The Hindi MT follow-up compared two models on three inputs and two targets (12 calls). The candidate also retained the price question and release hold. A separate 20-output candidate test used five fictional English/Telugu recording-sheet rows per source, directly translated into each other language. It preserved the English code-mixed release hold and the Telugu 150-rupee price. On the Telugu sales prompt it invented a pessimistic question in English and omitted the question in Hindi. No human voice-quality or live-room latency ranking follows from these runs.

Recommended demo rehearsal uses one managed pipeline: LiveKit, Saaras v4, sarvam-translate:v1, and Bulbul v4 Flash with per-language preset voices. English used Simran, Telugu used Kavitha for this candidate smoke, and Hindi used the provider default. The prior listener rejection concerned Telugu Pooja; Kavitha has yet to receive listener approval. Add Hindi in the existing room contracts and validate all six directions in one real three-person meeting before presenting this as shipped. Private inputs, outputs and provider receipts are in .sahva/trilingual-smoke-KlviVY.

### Three-person LiveKit rehearsal and voice decision

Three independent Chrome profiles published paced fictional English, Telugu and Hindi microphone recordings to the same LiveKit Cloud room, with a local Linux Sahva server and real provider calls. Each source produced one archived turn and two attributed, language-specific translations. The harness checked the caption in the listener's page, and, for audio deliveries, browser playback and the authorized WAV response.

| Direction | Bulbul routing control, onset to observed playback | Selected policy without a Sreekar endpoint |
| --- | ---: | --- |
| English → Telugu | 11.26 s | Caption at 9.61 s |
| English → Hindi | 11.25 s | Audio at 9.65 s |
| Telugu → English | 10.19 s | Audio at 10.16 s |
| Telugu → Hindi | 10.15 s | Audio at 10.16 s |
| Hindi → English | 11.18 s | Audio at 10.63 s |
| Hindi → Telugu | 11.19 s | Caption at 10.61 s |

One observation per direction in each configuration. Timings begin at source playback onset. The control verified six audio routes with Bulbul. The selected policy verified six caption routes and four audio routes; Sreekar did not synthesize during this call. The user rejected Kavitha after the separate audition and chose Sreekar. A fresh fictional Telugu Studio request hit its GPU quota without producing audio. The previous successful Sreekar Telugu sample remains private under .sahva/tts-comparison-F0KtYa/te-01-1-A.wav. The selected-policy call ended with a ready report containing zero supported items for the repeated instruction. The control's original test expected a citation and timed out on that valid empty result.

Use scripts/meeting-smoke.mjs with a directory containing fictional english.wav, telugu.wav and hindi.wav, plus --trilingual. With no Sreekar service add --telugu-captions; the audio-enabled test requires actual playback in every direction. Use SAHVA_SMOKE_ORIGIN to select the environment. Keep separate the operator's two blind voice preferences, engineering checks of meaning, provider-only timing, and real-room playback evidence. Hindi report localization and an end-to-end human ranking of all engines remain open.

### Approved substitute and release rehearsal

The operator approved Sarvam Tarun after hearing the Telugu preview. When the private Sreekar service is absent or fails, a Hindi-enabled meeting renders Telugu with tarun_te_narration, and the recipient sees the actual voice name. Other directions retain the tested managed pipeline. Both Telugu deliveries reported Tarun and passed browser playback checks. Final local-server observations from source onset to the browser observing playback: English → Telugu 12.38 s, English → Hindi 11.72 s, Telugu → English 10.80 s, Telugu → Hindi 10.80 s, Hindi → Telugu 10.75 s, Hindi → English 11.83 s. These are individual fictional turns; the inputs themselves last several seconds. Use --trilingual without --telugu-captions to verify the release. Set SAHVA_SMOKE_TELUGU_VOICE=Sreekar only for a deliberate trial with a private service. Archive prior captions-only and Bulbul-control results as separate configurations.

### Public release verification · c806285

One Hindi, one English and one Telugu Chrome profile joined the same meeting at sahva.madsoul.in after the image and both private buckets were verified. All six translated captions matched their listener-specific timeline entries. Both Telugu deliveries reported tarun_te_narration; Hindi reported shubh_enhi_ads and English simran_en_customer. Web Audio playback began for every recipient, and every authorized translated WAV returned valid media. The call ended and produced one report item; the harness checked each returned evidence turn ID. Public preview bytes for Tarun and Shubh matched the release files.

| Direction | Playback confirmed and listener timeline fetched, from source onset |
| --- | ---: |
| English → Telugu | 19.64 s |
| English → Hindi | 20.08 s |
| Telugu → English | 20.01 s |
| Telugu → Hindi | 20.65 s |
| Hindi → English | 20.17 s |
| Hindi → Telugu | 21.11 s |

Each time is an upper bound for playback start and includes the source phrase and a follow-up timeline fetch. The later console times of 22.08–23.24 s also include fetching the translated WAV again for verification. Neither measures last source speech to first sound on device. All six texts retained the prohibition on sending 15 and the correction to 12. Both Hindi-source outputs used containers as the shipment unit. A three-turn call cannot establish general accuracy or human listening latency.
