# Scope, Acceptance Criteria and Release Gates

## Current release gates

The dependency-ordered release tickets are in [the WBS](08_WBS_AND_PHASE_PLAN.md). The original timeboxed scope below describes the foundation. Accept the next public demo after a trusted HTTPS call on two real devices, bilingual review, measured delays by direction, reconnect and consent checks, and matching evidence from both report views. Keep manual recorded turns and the hands-free phrase path available. Enable experimental early playback only after the same-recording comparison and device tests pass.

## Rules
P0 is a demo-grade product, not a production communications service. Only promise what is tested. All acceptance conditions below are observable behaviors, not descriptions of components. If a feature fails, do not present it as complete.

## P0 (12-hour must ship)

| ID | Requirement | Testable acceptance |
|---|---|---|
| AC-01 | Room create/join | User A creates; B joins from incognito/another machine; room shows 2 distinct participants; third user is rejected politely. |
| AC-02 | Consent | Neither user can record until both agree to recording, storage and AI processing; revoked consent prevents additional recording. |
| AC-03 | Preferences | A chooses `te-IN`, B `en-IN`; each sees/hears other-party turns in preferred language. |
| AC-04 | Record | User can record 5–25 sec, stop, preview, submit, discard; >25 sec cut off with clear UX. |
| AC-05 | Original evidence | Original audio saved privately and can be played from timeline after page refresh. |
| AC-06 | Translation | 10s Telugu speech becomes English text and synthetic English audio; reciprocal English→Telugu works. Same-language turns don't require translation. |
| AC-07 | Timeline | Within polling interval after processing, both browsers show new turn with speaker, statuses, original and translated playback. Transcript toggle does not alter audio or other person's preference. |
| AC-08 | Failure | Failed STT/MT/TTS shows actionable stage-specific error and one retry; does not lose saved original or create a duplicate. |
| AC-09 | Conversation | Both sides exchange >=4 non-fixture turns (2 per person) on distinct devices. |
| AC-10 | End/report | End room; one canonical structured meeting record is generated from the accepted latest transcripts and original turn IDs; report shows summary, decisions, tasks, unresolved questions. |
| AC-11 | Evidence | Every task and decision links to at least one source utterance; unsupported claimed owners/dates are omitted or marked unresolved. |
| AC-12 | Localization | Same record shown in English/Telugu with identical item IDs, status, owners, due dates and source links; only prose differs. |
| AC-13 | Protection | Unauthorized participant cannot fetch another room's turns or private audio; secrets absent from browser/network source. |
| AC-14 | Demo ready | Deployed HTTPS URL, 2-device smoke pass, and fallback screen recording from the real build. |
| AC-15 | Revision | A speaker can correct erroneous transcript text; original ASR and audio remain; regenerated translation/report records new version. |

## P1 (add only if P0 passes)

- Meeting glossary: suggest/approve term, capped by provider limits; use on future STT and summary prompts.
- Explicit `agreed/proposed/unresolved` confirm/reject controls on report items.
- Same-recording comparison tab with raw provider output vs contextual/corrected handling; manually verified ground truth for 3 clips.
- Export Markdown notes and action list with provenance; simple single-use download.
- Replay source turn starting from an evidence click; highlight active timeline card.
- Persistent room for a short defined period and in-product delete action (if deletion pipeline completed).

## P2 (post-buildathon)
Continuous streaming voice, open mic, echo suppression/ducking, barge-in, LiveKit audio tracks, voice activity detection, multiple recipients and languages, team identity, billing, integrations, mobile clients, phone and WhatsApp connectivity, compliance audit.

## The 4 mandatory go/no-go checkpoints
**Gate 0 (hour ~1):** Verify live Sarvam credentials and output for Telugu→English and English→Telugu, including audible TTS. If unavailable, test provider fallback or pivot to honest text-only voice-note workflow.

**Gate 1 (hour ~4):** Two participants can join and exchange a real uploaded audio turn through persistence; otherwise stop UI polish and fix infrastructure.

**Gate 2 (hour ~8):** Four turns on two browsers, bidirectional translated audio, timeline replay; otherwise freeze additional features and ship robust conversation.

**Gate 3 (hour ~11):** Real report and source evidence pass QA; otherwise explicitly label summary as beta and do not fake decisions or reminders.

## Demo-grade thresholds (targets, not asserted measurements)
- >=4 actual turns, >=2 from each person
- 100% source/translated media accessible to proper room members on tested deployment
- Zero invented owners/dates in the adversarial ambiguity fixture
- At least one corrected transcript regenerates output (if AC-15 completed)
- At least one action item has valid source turn IDs
- Both language views agree on IDs/statuses/owners
- Target per-turn processing latency <=10s for a clean 10s utterance, instrument and display real values; no claim of guaranteed latency

## Submission-fit decision
**Voice AI for India:** Strong if same-recording base/system evaluation is implemented and honest.  
**SaaS in a day:** Possible if a complete create→join→transact→report→return workflow is solid and a reference product/differentiation are documented.  
**Personal context:** Could fit context/glossary but do not bend the story. Confirm organizer's official current rules before choosing.

## Live demonstration extension (LIVE-01)

- During a real Telugu phrase and an English reply, the peer sees changing source captions and a labeled translation draft before the archived turn appears.
- A pause finishes the phrase and the listening participant hears an automatically played translation in their chosen language after enabling incoming audio.
- Both original WAVs remain privately playable. The meeting record uses final source turns, and both localized reports link to evidence.
- The other member cannot finish someone else's live phrase. Consent withdrawal invalidates the stream, and the owner must finish the active microphone phrase before ending the room.
- Report microphone-button to first visible source and draft captions, plus finish-request to playback start. Include the device and provider conditions. Acoustic latency, overlapping speech and physical-device checks have separate gates in [the delivery plan](14_LIVE_DEMO_PHASES.md).

### Hands-free extension (LIVE-02)

- One activation per consenting participant supports four alternating, attributed phrases with original recordings, captions, drafts and translated playback in both directions.
- Silence, incoming playback on the default setting and timeline replay do not initiate a new turn. Headphone users can opt in to interrupt incoming voice by speaking. The playback button also supports explicit interruption.
- Mute releases the local audio tracks. Connection loss stops capture until the participant enables it again. Consent withdrawal stops both microphones. The four saved turns still support both report languages.
- Qualify physical acoustic echo, simultaneous speech and mobile microphone recovery on a desktop and phone before the public rehearsal.


## Experimental acceptance

Qualify a direction with a real authenticated response and healthy configured worker. Compare identical inputs, retain failed runs, and review critical facts bilingually. A later test room must demonstrate consent withdrawal, original replay, attribution, report evidence, ordered playback and explicit return to Standard.
