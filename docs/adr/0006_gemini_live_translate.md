# ADR-0006 — Evaluate Gemini Live Translate for group interpretation

**Proposed / experimental · 21 November 2026.** ADR-0005 governs production. The experiment asks whether listeners can understand the translation sooner without losing speech detail or the evidence behind a meeting record.

## Provider contract

Google lists `gemini-3.5-live-translate-preview` for its Developer API and Google Cloud enterprise/Vertex route (global). Use a server-side Gemini Developer API project key locally. The Cloud route uses project/location and authorized Cloud credentials. Google lists a Developer API free tier and paid audio rates of $3.50/M input tokens and $21/M output tokens. Effective quotas depend on project tier and capacity. Treat access, two-session concurrency and billing as project-specific. [Model](https://aistudio.google.com/docs/models/gemini-3.5-live-translate-preview) · [Cloud offering](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-5-live-translate) · [Rates](https://ai.google.dev/gemini-api/docs/pricing) · [Quotas](https://ai.google.dev/gemini-api/docs/rate-limits)

The Developer API supports the Google Gen AI SDK or raw v1beta BidiGenerateContent WebSockets. English and Telugu appear in the translation language list. Select target `en` or `te` per session. Send 100 ms chunks of little-endian mono PCM16 at 16 kHz. Receive mono PCM16 at 24 kHz and optional input/output transcription events. The input language is detected. Disable target-language echo and check mixed-language omissions. Setup-only translation guidance can supply domain terminology, register or addressee context. Begin with no glossary. Measure the actual lag at this chunk size. No translation-specific latency setting is assumed. [Protocol](https://aistudio.google.com/docs/live-api/live-translate.md) · [Google's streaming example](https://github.com/google-gemini/cookbook/blob/main/quickstarts/Get_started_LiveTranslate.py)

The general Live API documents roughly ten-minute connections and a 15-minute uncompressed audio session. Test GoAway, clean replacement, resumability, continuity and project quota on this preview before longer meetings. Preview behavior can change. Long pauses, fast speaker changes and accents warrant listening tests. Assess semantic fidelity, expression and voice similarity independently. Identity evaluation requires explicit speaker consent. Speaker-selected Sahva voices need their own acceptance test. [Session management](https://ai.google.dev/gemini-api/docs/live-session) · [Model limitations](https://aistudio.google.com/docs/live-api/live-translate.md#limitations)

## Alternatives and decision gate

Keep Sarvam as baseline and fallback. Earlier synthesis from stable Sarvam text is another candidate if Gemini fails. A hybrid route for one direction requires a separate decision and disclosed voice differences. Test two one-way Gemini sessions before considering any room change.

Preserve input PCM, the speaker and session epoch, event arrival offsets, original transcript events and finality flags. A receipt timestamp gives no word-to-source alignment. Link provisional output to the source interval and preserve revisions. Only validated final source turns may feed the canonical meeting record. Where alignment or finality is ambiguous, retain the existing archival ASR path and include its overhead in the decision.

Compare the same source recordings under the same playback sink and network conditions. Record speech onset, first caption, first voiced output, last voiced source, final playout and failure counts. Report provider arrival, scheduling and audible observation separately. Review bilingual blinded A/B pairs for meaning, errors in names/units/negation, omissions, hallucinations, pacing, questions and emotional emphasis. Measure cost per direction using consumed audio and billable text, including drafts and duplicated inference.

Advance to test-room integration only after real two-way output, repeatable earlier playback in both directions, no material semantic regression and adequate consent, transcript and routing controls. Record sample count, paired medians and p95 when justified. Require verified reconnect, interruption, speaker-selected voice behavior, real-device feedback control, and unchanged evidence-linked summaries before a release decision. Retain Sarvam when results are mixed, measurements are missing or the preview cannot meet these requirements.

## Trial decision · 21 November 2026

Retain Sarvam for the public meeting. Both Gemini directions worked concurrently, but the matched trial exposed errors in quantities, negation, code-switching and question intent. A fresh candidate or scoped mitigation can reopen the trial after it passes these specific recordings and held-out equivalents. Human evaluation of prosody and device acoustics remains open. [Benchmark and reproducible evidence](../../qa/S2ST_BENCHMARK.md)
