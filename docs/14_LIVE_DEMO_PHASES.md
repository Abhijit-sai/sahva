# Live interpreter delivery plan

The initial two-person recording MVP provides the data, provider and meeting-record foundation. The new demo goal is a conversation where each listener can follow live text, hear the other language automatically, and leave with the same supported decisions and next steps. Use the latest dated PROJECT_SUMMARY.md entry for test results and deployment status.

| Phase | Deliverable | Demonstration gate |
| --- | --- | --- |
| 1. Voice room foundation | Invitation, two identities, consent, speaking and listening preferences, private storage. | Join through independent profiles. Refuse a third seat and stop on consent withdrawal. |
| 2. Recorded translation | Original and translated audio, source and translated text, replay, correction history, retry. | Exchange Telugu and English turns and replay originals after refresh. |
| 3. Meeting intelligence | One evidence-linked record with English and Telugu presentations. | Both participants review matching decisions, proposed actions and questions. Evidence leads back to the speaker's turn. |
| 4. Live phrase interpretation | Actual interim captions during speech, revisable translated drafts, pause detection and automatic incoming voice. | Two isolated browsers see captions before the phrase finishes, then each hears a translation in the selected language without pressing Play. Preserve the full original and final turn. |
| 5. Continuous conversation | Enter interpreting once, re-arm after playback, explicit mute and leave, turn-taking during interruptions, reconnect and echo control. | Two people speak several alternating phrases without tapping Speak for each. Test headphones and speakerphone, network loss, and overlapping speech. Evaluate LiveKit/WebRTC if continuous remote tracks are needed. |
| 6. Judge-ready deployment | Trusted HTTPS, desktop and phone, real speakers, native-language review, a synchronized backup capture and deployment rollback. | Rehearse the entire conversation and meeting outcomes on the target network. Record mic onset to source/draft captions and end of speech to first audible translation, by direction, with several samples. |

Phases 1–4 passed local integration checks with real providers. Phase 5 now supports four alternating phrases from a single activation per participant. In two independent browser sessions, silence left the provider idle, the default playback guard suppressed simulated speaker bleed, and a headphone listener could speak to interrupt a translation. Mute, disconnect, consent withdrawal and bilingual reports passed. Physical microphone pickup, speakerphone echo, natural pauses and simultaneous starts between two people still need a device rehearsal. Phase 6 remains open.

### Expressive translated voice (VOICE-01, planned)

The current Telugu preset uses Bulbul v4 Flash at 1.2× pace with pitch −0.1. For the next voice phase, let the speaker preview translated voices and optionally choose the voice or delivery style they prefer at join. Include low, mid and higher voice samples where supported. Any gender preference comes from the participant. Evaluate preserving emphasis, pace and question intonation against the original. Use an optional speaker-confirmed tone cue when assessing emotional expression, and keep it out of the canonical meeting facts. Two fluent listeners should compare a neutral and expressive rendering of the same sentences and judge intelligibility, tone and naturalness before changing defaults.
