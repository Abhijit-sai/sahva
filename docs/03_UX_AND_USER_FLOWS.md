# UX Blueprint and State Flows

## Two-person audio call

The laptop speaker reported that translation worked in the first rehearsal. The interface made it unclear which voice and text belonged to each message. Keep participants and call controls alongside the thread. On a phone, show controls and messages in the same scrolling view. One explicit call activation enables incoming audio and hands-free capture. A remote phrase plays in the listener's selected language as soon as it is ready and safe to play. Attach its translated caption and replay control to the same attributed message. **Original** reveals the source recording and transcription together. Own messages prioritize what the speaker actually said. Keep manual recording and diagnostics secondary.

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


## Internal Translation Lab

The loopback listening lab already offers language and whole-engine selection, upload, microphone, replay and human review. The experimental stage view should pair a source recording with its verified text, hide unavailable pipelines, identify the revision and separate inference time from listener playback. Guest join flows use language preferences.


## Proposed interpreted meeting journey

Pre-join offers an output test. Join meeting audio unlocks the selected device, with a persistent Enable meeting audio action if the browser suspends output. Show microphone and output states independently. Listening means output is armed. Speaker active comes from source activity. Translating follows committed source text. Translated audio playing requires client playout evidence. Use Catching up for overlapping or stale phrases and keep missed items in the speaker-labelled timeline. Muted, Reconnecting and Consent withdrawn have distinct recovery actions. Headphones support interruption. Speakerphone requires echo control.

Presenter listeners join receive-only and see their language, the actual delay and a buffering indicator. A language switch or camera/screen discontinuity resumes from a shared source anchor. Original replay is an explicit choice.

In the local interpreted room, Meeting audio appears above the participant tiles and conversation history. The microphone channel shows the speaking language, capture state and mute action. The incoming channel shows the listening language, receiver state, mute action and listening volume. Browser-block recovery stays beside that channel. A speaker test is available before audio join. Each remote speaker's live original and interpretation appear together below the tiles, with the listener's own transcript labelled separately. On phones the controls precede captions and replay in reading order. In the room-scoped Gemini trial an incoming audio indicator means the browser observed a mixed signal, which may contain original speech alone.
