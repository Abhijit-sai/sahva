# Product Requirements Document — Sahva P0

**Version:** 1.0 | **Status:** Proposed for initial build | **Timebox:** 12 hours | **Owner:** Product/engineering team

## 1. Problem statement
A Telugu-speaking field lead and an English-speaking colleague need to coordinate an assignment. They can speak naturally, but direct English-only communication loses detail. Typical meeting tools may translate or summarize, but they don't consistently expose original and translated voice turns, preserve user corrections, and produce a jointly reviewable action record with evidence. People leave unsure what was actually agreed.

## 2. Solution
A browser-based, audio-only, turn-based meeting room. Each participant provides a preferred listening language; speech is recorded in bounded turns. The backend transcribes, translates and synthesizes a clear AI-generated spoken version for the other listener. The shared timeline contains source audio, translated audio, and toggleable transcripts. After the call, the product compiles a **single language-neutral structured record** of summary, decisions, actions, owners, dates and unresolved questions, then localizes the presentation for each participant.

## 3. Primary users and jobs
- **Cross-language colleague:** I want to understand tasks without being forced to speak English.
- **Team lead / room owner:** I want an actionable record of what was agreed, with original evidence.
- **Recipient:** I want to verify a suspicious translation using original audio and ask for correction.

## 4. Core user stories
US-01 As a room owner, I can create a temporary room with a shareable invite so another participant can join.  
US-02 As a participant, I can choose my name and preferred listening language before entering.  
US-03 As a participant, I must explicitly accept recording and external AI processing before any audio is collected.  
US-04 As a participant, I can see presence and whose turn is recording/processing.  
US-05 As a speaker, I can record a <=25-second voice turn and review/submit or discard it.  
US-06 As a recipient, I receive the turn without manually refreshing the page (short polling acceptable for P0).  
US-07 As a participant, I can replay the speaker's original audio at any time during retention.  
US-08 As a recipient, I can play the translated voice, clearly labeled synthetic.  
US-09 As a participant, I can toggle original and translated transcripts independently.  
US-10 As a participant, I see a visible pending/error/retry state rather than an absent turn.  
US-11 As a participant, I can retry a failed translation/TTS operation without duplicating the turn.  
US-12 As a participant, I can correct a transcript, preserving original text, author and change time.  
US-13 As a participant, I can suggest a specialized word for a glossary; approval is explicit (P1 if time).  
US-14 As a room owner, I can end the call once; repeated requests are safe.  
US-15 As a participant, I see a short overview, accepted decisions, proposed actions and unresolved questions.  
US-16 As a participant, I see accountable owner, due date and status only where there is supporting evidence.  
US-17 As a participant, I can open supporting utterance(s) from a report item.  
US-18 As a participant, I see the same structured meeting facts in my preferred language as another participant sees in theirs.  
US-19 As a participant, I can mark a suggested commitment as accepted, rejected or needing clarification (P1).  
US-20 As a room owner, I can request deletion of meeting data, including generated audio and meeting record (manual admin path acceptable during demo but must not falsely claim automated deletion).  
US-21 As a recipient, I receive a meaningful fallback when no speech is detected or a translation fails.  
US-22 As a participant, I am never shown an AI assumption as a confirmed decision or agreement.  
US-23 As a demo operator, I can run a same-audio baseline/system comparison with transparent labels (P1; important for Voice AI challenge).

## 5. Functional requirements
### FR-01 Rooms and presence
Create, join, disconnect and end a room. P0 limit two participants; invite is scoped and hard to guess. Late joiners are warned about stored recordings. Joining doesn't imply consent. Store participant's preferred listening language (English `en-IN` or Telugu `te-IN`).

### FR-02 Audio capture
Explicit press-to-record / stop; 25-second max P0; capture progress and microphone errors. Avoid publishing a permanently open raw microphone audio stream. Do not call the experience simultaneous translation.

### FR-03 Translation pipeline
Save original first. Transcribe with source language detection where possible, save ASR text and detected code. Translate only when recipient's listening language differs from detected speech language. Generate translated audio and persist private URL. If same language, reuse original audio unless user explicitly requests AI voice. Source transcript should remain available. Failed stages are transparent and retryable.

### FR-04 Timeline
Each turn displays speaker identity, time, duration, audio player for source and translated clip, transcript toggle and status. New turns appear to both clients; a recipient doesn't need to take an action to find them. Automated translated playback may require the initial user interaction to unlock audio, else show a Play button.

### FR-05 Corrections and glossary
P0 correction stores a `TranscriptRevision` and can trigger retranslation/report refresh. P1 approved glossary terms bias ASR or guide downstream interpretation. Never mutate or erase original audio or raw ASR output.

### FR-06 Meeting intelligence
Generate one language-neutral record from the best approved transcript revisions per turn, with `summary`, `decisions`, `action_items`, `unresolved_questions`. Every factual item has source turn IDs. For status, use `agreed`, `proposed`, `unresolved` and confidence/caveat. Dates include precision and timezone; relative dates are not silently anchored without knowing the meeting date. Empty arrays are acceptable and preferred to invention.

### FR-07 Localized outcomes
Translate the canonical report's prose fields while retaining stable identifiers, people, dates, source evidence and status. Reports need English and Telugu renderings; view language can change without regenerating meeting facts. Fall back to source text with a warning if localization fails.

### FR-08 Evaluation mode
For at least 3 fixed test utterances, capture baseline provider output and enhanced-system output. Show actual differences and errors. Never fake benchmark gains or claim an LLM corrected content without speaker review. If no measurable improvement, emphasize workflow value; check event category rules before choosing submission.

## 6. Nonfunctional requirements
- **Responsiveness:** Pending state appears <=1s after submission; target (not guarantee) translated result in <=10s for a 10s clean audio clip on test connectivity. Record actual p50/p95 later.
- **Reliability:** Idempotent turn submission, no duplicate report on retry, stage-specific retry paths.
- **Security:** TLS, provider keys server-side, short-lived signed private audio URLs, room authorization and explicit consent.
- **Accessibility:** Text and audio both available; keyboard-operable recording and playback; high contrast status cues.
- **Compatibility:** Chrome desktop/mobile first; microphone and playback permissions tested. Safari secondary.
- **Observability:** Trace ID, stage timings, provider status and error codes, no sensitive transcript/audio in logs.
- **Cost:** Bounded audio length, API call timeouts, room and clip limits; no unbounded background processing.

## 7. Implementation decisions
- P0 calls are discrete turns, not continuous open-mic interpretation. `docs/adr/0001_turn_based_room.md`.
- Room UI is a two-column audio controls/presence + conversation timeline view. `docs/03_UX_AND_USER_FLOWS.md`.
- One canonical meeting record, language-localized projections. `docs/adr/0002_canonical_meeting_record.md`.
- Stage-specific adapters for ASR, MT, TTS, and LLM. `docs/04_APPROACH_ARCHITECTURE.md`.
- Persist original audio even if translation fails. `docs/06_DATA_MODEL.md`.
- Evaluation uses honest same-recording baseline; enhanced system includes corrections/context/evidence, not a secretly different recording.

## 8. Testing decisions
Test at domain seams: authorize room/participant; submit and deduplicate a turn; process/translate a turn with stub providers; create and localize a meeting record without changing evidence/owners/dates. Validate actual external APIs with smoke tests, not mocked provider assumptions. Human evaluate Telugu/English quality, including numbers and names.

## 9. Exclusions / future
Continuous WebRTC voice calling, interruption handling, true realtime speech-to-speech, phone/WhatsApp integration, video, 3+ participants, company workspaces/billing, calendar/tasks integrations, custom voice training, legally binding document creation.

## 10. Outcome metric
Pass the two-device test with four new utterances, original/translated replay, a shared factual summary in both languages, and correct handling of one intentionally unconfirmed commitment. See `docs/02_SCOPE_ACCEPTANCE.md`.
## 11. Live demonstration expansion (2026-11-21)

The next demonstration adds real-time source captions, revisable translated drafts and automatic translated speech after each detected phrase. Participants keep the private original, timeline, corrections and canonical outcomes. The following phase addresses hands-free conversation and interruption handling. See [live delivery phases](14_LIVE_DEMO_PHASES.md) and [ADR-0004](adr/0004_live_interpreter.md).

In hands-free mode, each participant activates once and can mute at any time. A headphone listener can opt in to interrupt spoken playback with a reply. The next voice milestone adds optional speaker-selected voice and delivery preferences. Evaluate expressive synthesis with fluent speakers before using it in a demo.
