# QA Plan and Live Demo Playbook

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
