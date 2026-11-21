# Voice Evaluation Cases — Telugu and English

These are **test scripts**, not recordings and not verified ASR/MT results. Ask consenting speakers to record them naturally, including code-mixing. Build gold transcripts/translation manually with native-speaker review.

## Seed test cases
| ID | Source | Spoken script / scenario | Expected behavior to inspect |
|---|---|---|---|
| VT-01 | Telugu | `రమేష్ సోమవారం 20 కార్టన్లు పంపిస్తాడు.` | Preserve owner, Monday and quantity (don't invent date) |
| VT-02 | English | `Okay, but please confirm the pickup time before we finalize.` | Identify unresolved pickup time, not a completed decision |
| VT-03 | Telugu | `ఇరవై పెట్టెలు పంపగలం, కానీ రేపు ఖచ్చితంగా చెప్పాలి.` | Conditional commitment; 'tomorrow' relative/needs anchoring |
| VT-04 | English | `The price is fifteen per kilo, not fifty.` | Disambiguate fifteen vs fifty; preserve unit |
| VT-05 | Telugu-English mix | Say `Guntur Sannam S4` within a natural Telugu sentence | Product term, keyterms, manual transcript correction |
| VT-06 | English | `Sarah might send the revised document next Friday.` | Proposed/tentative; don't assert deadline as agreed |
| VT-07 | Telugu | Conversational correction: `లేదు, పది కాదు, ఇరవై.` | Preserve correction meaning: not ten, twenty |
| VT-08 | English | `Let's see if Ravi can take it. Nothing is confirmed yet.` | No owner assignment without acceptance |

## Result capture template
For each clip, record: local fixture ID, consenting recorder ID (non-identifying), audio format, duration, language, ground truth transcript, provider raw transcript, translated text, human evaluation, important-entity accuracy, ASR/MT/TTS latency, errors, used keyterms, and system revision. Avoid real account/phone information.

## Honest same-recording baseline
- Keep the exact same clip bytes and content for both baseline and enhanced paths.
- Baseline: raw provider STT and translation settings (no extra room keyterms).
- Enhanced: approved room-specific vocabulary, correction workflow and context-linked interpretation. Label manually corrected spans explicitly.
- Compute WER/CER only with reference transcript; don't claim improvement simply because English text looks smoother.
- Capture how summary status differs (`proposed` vs `agreed`) as a separate functional metric, not a fake transcription accuracy gain.
