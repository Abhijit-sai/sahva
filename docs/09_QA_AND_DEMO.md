# QA Plan and Live Demo Playbook

## Phone and laptop rehearsal · LIVE-03

1. Use a browser-trusted HTTPS origin with the current build on both devices. A phone's localhost points to the phone. Start in separate quiet spaces with headphones. Record device, OS/browser, network, build revision and audio route.
2. Create a fresh English-speaking/listening room on the laptop. Open the complete invitation on the phone, select Telugu for speaking and listening, and consent on both devices. Deny microphone once, restore permission in browser settings, then tap **Join audio call** on each. Check the listening indicator.
3. Alternate four fresh phrases. On the phone, name a person, quantity and weekday in Telugu. On the laptop, ask a question in English. Propose one action, then explicitly agree to a different one. Pause naturally. Per phrase, note who spoke, first syllable, attributed captions, draft, original and translated playback, and any missing or repeated speech.
4. Repeat on device speakers with the headphone interruption option off. Check that generated audio never creates another turn. Try simultaneous starts, headphone interruption, background/foreground, temporary network loss during speech, explicit re-arm and mute. Note any lost phrase and recovery message. Repeat in light background noise.
5. Before ending, capture timing counts, median, p95 and maximum by direction and setup. Separate device playback observation from what the listener actually heard. Then end the room, compare both report views, verify quantities, tentative commitments and absent deadlines, and replay the original for each cited outcome.
6. Record the first failure with device, direction, turn number, expected vs observed behavior and last successful stage. Keep URLs, names, audio and transcripts out of the shared ledger. Check archived evidence separately with consent. Use the same audio bytes for the base-model comparison in [the voice cases](../qa/VOICE_TEST_CASES.md).

**Status:** proposed test plan. No tests or measurements have been performed by writing this document.

## Quality strategy
Test end-to-end user outcomes at the highest seam possible, with a few focused deterministic tests on domain invariants. External speech quality must be evaluated with real recordings and native speakers; mocks validate logic, not linguistic performance. Check the event's current Voice AI track requirement about same-recording baseline/system comparisons.

## Automated tests (P0)
1. **Room service:** third participant rejected; expired token rejected; participant cannot access another room; consent missing blocks upload; end requires owner and is idempotent.
2. **Turn processing:** duplicate upload key maps to same turn; invalid MIME/oversize/too long rejected; original saved despite MT/TTS failure; retry resumes correct stage without duplicating source.
3. **Meeting extraction:** rejects unknown evidence turn IDs; empty call returns empty record; proposed != agreed; unknown due dates remain null; owner requires evidence.
4. **Localization:** all IDs, statuses, owner references, dates and evidenceTurnIds identical across `en-IN`/`te-IN`; no extra or dropped items.
5. **Correction:** old transcript remains accessible; current revision increments; stale report cannot replace a newer revision's report; concurrent edits conflict.
6. **Security:** no provider key serialized in JSON or client bundle; media URL endpoint validates member token and room membership; no raw storage public links.

## Manual browser matrix
| Environment | Primary? | Test |
|---|---|---|
| Chrome desktop A + Chrome incognito B | Yes | Join, record, receive, play, refresh, end, report |
| Chrome Android + Chrome desktop | Yes if available | Permission dialog, short-turn recording, playback gestures |
| Chrome with mic denied | Yes | Clear recoverable state, no fake empty utterance |
| Slow network simulation | Yes | Loading/retry states, no duplicate turns |
| Safari desktop/mobile | Secondary | At least join/play; verify supported `MediaRecorder` type |
| Two devices same room | Mandatory | Distinct participant IDs, two-way 4-turn smoke |

## Linguistic evaluation
Use real, consented clips in `qa/VOICE_TEST_CASES.md`, ideally 6-10 seconds each. Human writer supplies exact transcript/translation or annotates uncertainty. Track proper nouns, quantities, dates, currency and terminology. **Do not present untested translations as facts**.

For Voice AI comparison, show exactly the same original audio and conditions for:
- **Baseline:** vendor transcript/translation without room-specific corrections/keyterms.
- **Sahva:** vendor transcript with optionally approved keyterms + explicit human correction + shared context and action extraction.
- Label which improvement was manual vs algorithmic; no claim of higher word accuracy unless calculated against ground truth.
- Metric: WER/CER for transcripts if manually verified; important entity pass rate (names, quantities, dates); latency recorded separately.
- It is acceptable to show an unresolved ambiguity and request human confirmation rather than force a 'corrected' answer.

## Adversarial test cases
A. 'We might dispatch Monday' => `proposed`, NOT agreed.  
B. 'Ravi will do it' after ambiguous antecedent => owner unknown or question, not confident assignment.  
C. 'Fifteen' versus 'fifty' in noisy audio => uncertainty flagged, do not invent numeric correction.  
D. 'Guntur Sannam S4' => preserve exact term when corrected.  
E. 'We can send 20, if you confirm' => conditional, not unconditional promise.  
F. 'Next Friday' => calculate from room local date ONLY if unambiguous; otherwise unresolved date.  
G. One user changes listening language mid-room (P0 may disallow) => clear unsupported response; do not mix past translations.  
H. Two concurrent uploads => deterministic turn sequence/owner identity; no duplicates.

## Provider smoke evidence template
| Check | Actual result | Latency | Notes |
|---|---|---|---|
| Telugu ASR | NOT TESTED | — | |
| Telugu→English MT | NOT TESTED | — | |
| English TTS | NOT TESTED | — | |
| English ASR | NOT TESTED | — | |
| English→Telugu MT | NOT TESTED | — | |
| Telugu TTS | NOT TESTED | — | |

## Three-minute demo script (not a fake recording)
**0:00–0:20:** Two colleagues speak different languages. Show room being created and joined with visible consent.  
**0:20–1:20:** User A speaks real Telugu; B receives translated English voice and text. B replies in English; A receives Telugu audio. Replay the original source and toggle transcripts.  
**1:20–2:00:** One person makes a *proposed* commitment and the other explicitly accepts another; end room.  
**2:00–2:35:** Show one common record with decisions, actions and unresolved questions in English and Telugu; click evidence to original audio.  
**2:35–3:00:** Show honest same-audio comparison if P1 exists; otherwise state the underlying model + our session, evidence and action layer. Close with practical benefit, not model buzzwords.

## Demo environment and backup
Use two accounts/browser profiles + headphones to prevent acoustical echo. Pre-test mic access, speaker output, browser gesture for auto-play, event Wi-Fi or backup hotspot, rate limit headroom, deployed environment secrets. Keep 1 consented real test room and a 3-minute screen capture from the actual build as a network backup. Never substitute fake canned outputs for the live test without explicit labeling.

## Release checklist
- [ ] Repo state inspected; no unreviewed changes
- [ ] Provider tests real + passed or limitations listed
- [ ] HTTPS deployment accessible
- [ ] Two participant join/consent correct
- [ ] Both translation directions with audio work
- [ ] Original and translated audio persist/private
- [ ] Source and translated transcript toggle works
- [ ] Summary and tasks render in both languages
- [ ] Evidence and commitment status honest
- [ ] Permissions and bad-input checks pass
- [ ] No secrets / PII in logs
- [ ] 3-minute rehearsal with fresh audio
- [ ] Real fallback recording and limitations disclosure


## Self-hosted experiment

Target 30 or more consented utterances per direction, including held-out voices and regional accents. Compare ASR on the same PCM, MT on confirmed source, TTS on verified target, and full pipelines on original-paced replay. Preserve recorded pauses. Record repetitions, failures, cold/warm p50 and p95, queue time, captions, commit, translated text, first decodable audio and browser playback start/end. Identify proxies and missing observations. Collect blinded meaning, names, quantities, polarity, omissions and naturalness scores separately. Live qualification includes two and three speakers, headphones, speakerphone, withdrawal and original replay.


## Interpreted media acceptance matrix · proposed

Use QA identifiers below independently of WBS ticket numbers. For every run record build, flags, source PCM digest, actual voice, browser/device, output route, source clock, network and test level. Separate synthetic browser decoding from physical sound. Measure last voiced input to first receiver output and offset uncertainty, and record per-direction p50/p95 plus sample counts. Repeat on separate networks, headphones and speakerphone, iOS Safari and Android Chrome. Require fluent review of commitments, dates, units and negations. For presenter, instrument ten markers at 1/3/10 minutes and record p50/p95/worst offset, rebuffers and peak memory.

| ID | Condition | Expected behavior and proof |
| --- | --- | --- |
| QA-CALL-01 | A (Telugu) speaks; B listens English | Translated audio **automatically audible** without clicking a message; captions appear; record playout telemetry |
| QA-CALL-02 | B responds English; A listens Telugu | Same in reverse; no late or wrong-language sample |
| QA-CALL-03 | A speaks Telugu, B English, C Hindi | One source mic, two correct target-language outputs; correct attribution and permissions |
| QA-CALL-04 | B chooses English matching source | Source/original audio eligible, no unnecessary synthetic voice; captions retained |
| QA-CALL-05 | All three talk within same 2 seconds | Three distinct source tracks and transcript IDs; interpreted audio collision policy explicit; no silent loss |
| QA-CALL-06 | Speaker interrupts a playing translation | Capture continues; user hears predictable interrupt/duck, backlog status; no deadlock |
| QA-CALL-07 | Short pause mid-question or negation | No premature misleading spoken sentence; tentative captions may revise |
| QA-CALL-08 | Very long clause | Progressive stable segments, bounded lag; explicit catch-up state |
| QA-CALL-09 | Playback disallowed by browser | Join gesture unlock, persistent actionable enable-audio state; no false 'playing' |
| QA-CALL-10 | Headphones removed / speakerphone used | Echo suppression avoids repeated translated turns; record acoustic result |
| QA-CALL-11 | Mobile background, app switch, lock | Explicit resume state, no uncontrolled backlog or auto-replay |
| QA-CALL-12 | Disconnect 1–10 seconds then reconnect | Monotonic epoch, no duplicate translation, missed captions/replay available |
| QA-CALL-13 | Listener mutes incoming sound | Captions persist, no auto-play; unmute joins live boundary |
| QA-CALL-14 | Source mutes microphone | Source processing stops and active turn completes/cancels correctly |
| QA-CALL-15 | Any participant withdraws consent | Server cancels processing, unpublishes/halts audio, clears queue/buffers; old private media policy enforced |
| QA-CALL-16 | Change language or voice mid-sentence | New config applied at safe segment boundary, old output drained with explicit status |
| QA-CALL-17 | TTS times out after source transcription | Caption/original survives; translation unavailable label; retries idempotent |
| QA-CALL-18 | Provider emits duplicate or reordered chunks | Deduplicate by epoch/segment/seq, reject wrong timestamps; playback ordered |
| QA-CALL-19 | Two listeners request same language but different voices | Correct voice per listener/group; no cross-target mix |
| QA-CALL-20 | End room during playout | Stop publishing, release tracks and workers, retain durable evidence; report based on committed source |
| QA-CALL-21 | Playback very delayed | Explicit catch-up state and bounded queue; no silent truncation of commitments |
| QA-CALL-22 | No incoming speech | Idle, no invented captions or audio; no unnecessary GPU cycle burn |
| QA-CALL-23 | Numeric negation, dates and amounts | Human review catches critical inversions; stop promotion if critical-error gate fails |
| QA-CALL-24 | Unauthorized listener attempts track/media access | Denied by server, not merely hidden UI |

## 3. Presenter acceptance matrix
| ID | Condition | Expected behavior and proof |
| --- | --- | --- |
| QA-PRES-01 | Presenter mic + camera start | Separate source tracks identified with one source timeline; viewer sees delayed video and translated speech |
| QA-PRES-02 | Screenshare replaces camera | Track switch epoch, keyframe/discontinuity re-anchor, no phantom old video |
| QA-PRES-03 | Slide change + spoken 'Next slide' | Captions and translated speech align reasonably with visible change; log source/event/playout offsets |
| QA-PRES-04 | Hand gesture accompanying speech | Delayed video aligned with translated semantic segment, **not exact lip-sync claim** |
| QA-PRES-05 | Translation takes 2s, then 8s | Dynamic bounded delay/rebuffer keeps semantic alignment; UI indicates lag; no growing unlimited queue |
| QA-PRES-06 | Two listeners in Telugu and Hindi | Independent language playout schedules; one global video offset not falsely assumed correct |
| QA-PRES-07 | Listener switches language mid-presentation | Flush old rendition, start new at matching PTS/keyframe; no overlapping languages |
| QA-PRES-08 | Listener joins mid-broadcast | Wait for source-aligned audio + video buffer; does not jump to mismatched live head |
| QA-PRES-09 | Presenter pauses then resumes | Silence recognized, clocks don't drift, segment IDs resume correctly |
| QA-PRES-10 | Camera pauses or bandwidth degrades | Video rebuffer or degrade to correctly labeled audio+captions, not mismatched video |
| QA-PRES-11 | Network packet loss/reconnect | Buffer bounds and anchors recover; no 30-second runaway delay |
| QA-PRES-12 | Presenter shares system audio | Explicit inclusion/exclusion and mix policy; avoid duplicate STT from mic+screen audio |
| QA-PRES-13 | Presenter disconnected/replaced | Role transfer, safe consent check, epoch reset, clear 'Waiting for presenter' |
| QA-PRES-14 | Browser unsupported by chosen buffered player | Feature check and fallback; preserve captions/audio and display limitation |
| QA-PRES-15 | Long talk (10/30 minutes) | Memory bounded, video/audio drift within reviewed tolerance, old segments evicted |
| QA-PRES-16 | Recording/retention revoked | Stop egress/composition and purge ephemeral video/audio buffers appropriately |
| QA-PRES-17 | Translation provider fails | Warning and original/captions-only fallback, not incorrect language with confident status |
| QA-PRES-18 | Camera or screen track ends unexpectedly | End/switch state, avoid stale-frame freeze without notice |

### CALL-03 radio trial

Run the opt-in radio transport test with the local LiveKit test server on port 17880 and `SAHVA_RADIO_RTC_TEST=1 npm test`. Each mic carries a different source tone and each interpreter direction returns a different target tone. Require at least twenty decoded 20 ms frames above the target-frequency threshold per intended receiver, zero frames above the other target's threshold, exactly one remote speaker publication each and recipient-scoped captions. Mixer tests separately check 10% source gain under voiced interpretation and recovery during silence.

For physical acceptance, record the time from speech end to first audible translated word on the listener's device separately from the first audible original. Repeat with pauses, meaningful assent, negation and overlapping replies across English, Telugu and Hindi. Test both headphones and open speakers. Check that mic mute, consent withdrawal and disconnect end the intended route. A mixed-signal decode mark alone cannot establish translated-word onset or meaning.

For the regular Gemini meeting build, compare saved private WAV data against the PCM frames submitted to each recipient publication. Verify a failed write contributes no audio, note corrections leave the replay unchanged, another participant cannot retrieve it, and a stale consent epoch cannot persist it. Exercise full language tags, including fr → zh-Hant and pt-BR → fil. Transport and configuration checks establish neither physical speaker output nor fluency.
