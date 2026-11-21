# UX Blueprint and State Flows

## Layout
Desktop 60/40 or 50/50 split: **left = live room controls/presence**; **right = conversation timeline / report**. On mobile, switch with accessible `Room` / `Conversation` tabs. No video. Clear label: **'Turn-based audio room'**, not 'simultaneous call'. Minimal navigation.

## Screens
**S0 Start:** Sahva wordmark, one-line promise, Create room. Language `en-IN` / `te-IN` (clear script and labels).

**S1 Join/consent:** Name, preferred listening language, visible disclosure: 'Your audio is recorded, stored temporarily, sent to AI speech/translation providers, and may be reviewed by room participants.' Separate `Agree & join`; cancel. Display participant count / invited members. Consent logged server-side with version/timestamp.

**S2 Room:** Left: title, connected members (names/languages), meeting duration, network and microphone permission state, Record (max 25s), Stop, Preview, Submit/Discard, End room (owner only). Right: chronological cards. Each card: speaker, language, timestamp, source audio control, recipient translation audio control, `Show transcript`, source/translated text labels, pipeline status, error Retry. A small processing chip shows ongoing work; placeholder card appears immediately. Text is hidden by default if user toggles off; transcript availability independent of audio.

**S3 Post-call:** same shell, right panel becomes `Summary`, `Decisions`, `Actions`, `Open questions`. Language switch previews alternative localized report. Every item shows status and 'Evidence: Turn 03'. Report may be edited/reviewed later in P1 but does not become a false guarantee.

**S4 Error and recovery:** bad invite / room full / denied microphone / lost connection / STT failed / translation failed / TTS failed / report invalid. Each has a plain-language action and preserves any successfully saved work.

## Recording interaction states
`idle -> recording -> preview -> submitting -> uploaded -> processing -> ready`.
- `recording -> discarded` returns to idle, no upload.
- `submitting -> upload_failed` offers local retry while blob remains in memory.
- `processing -> stt_failed|translation_failed|tts_failed`; retry affected stage by `turnId` and idempotency key.
- Clip exceeding 25s auto-stops and informs speaker; hard server reject >30s to respect provider limit.
- Press-to-record does **not** publish an open mic to the other participant.

## Room states
`created -> active -> ending -> ended -> summarizing -> summarized|summary_failed`.
- End is idempotent. New turns rejected once `ending` begins.
- Members can leave/rejoin with their room token until end/expiration.
- If B disconnects, A can record but must see B is not present; do not silently claim B heard a translation.
- If session expires, show export/delete guidance, never a functioning-looking dead room.

## UX examples (not actual results)
1. Ravi says in Telugu: 'రమేష్ సోమవారం 20 కార్టన్లు పంపిస్తాడు.'
2. Sarah sees: original audio; synthesized English 'Ramesh will send 20 cartons on Monday.'; Show transcript.
3. Sarah replies: 'Okay. Please confirm the pickup time.'
4. Ravi hears Telugu voice and sees localized text.
5. The final report shows 20 cartons and Monday **only if source evidence supports them**, and pickup time as unresolved.

## Visual UX requirements
- UI distinguish source audio (microphone/waveform) and synthesized audio (sparkles/headphones) unambiguously.
- Explicit states: `Saved original`, `Transcribing`, `Translating`, `Generating voice`, `Ready`, `Needs attention`.
- Record controls work from keyboard and touch. Avoid hover-only actions.
- Use accessible contrast, captions, audio playback rate 1.0 default, unambiguous speaker labels.
- Time display relative and absolute available; anchor due dates to meeting time zone `Asia/Kolkata` for demonstration unless room provides another.

## Recovery scenarios
- Browser blocks auto-play: display 'Tap to hear translation' button.
- Speech recognition returns empty: show 'No speech detected; try again' and keep original clip.
- Translation unavailable: keep original audio/transcript; mark recipient language translation unavailable, never substitute a fabricated clip.
- Source text corrected: display current approved revision, with 'Show original ASR' history entry.
- Provider sends wrong language code: validate and retry manually; do not silently produce speech in the wrong language.
