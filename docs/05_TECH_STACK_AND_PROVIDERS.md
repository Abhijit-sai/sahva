# Technology Stack and Provider Validation

## Provider decision for this release · 21 November 2026

Keep the installed fetch/WebSocket integration. Saaras v4 accepts base64 mono linear16 and sends partial/final events. Mayura v1 accepts up to 1,000 characters for both directions. Bulbul v4 Flash supports language-specific personas, REST WAV and streaming transports. Benchmark first playable PCM against the full WAV at identical text and voice. Recheck the account's quota and persona catalog before a live run. [ASR protocol](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming) · [Translation](https://docs.sarvam.ai/api-reference/text/translate-text) · [Bulbul](https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul)

At published pay-as-you-go rates, estimate ₹0.49 per ASR minute, ₹2 per 1,000 translated input characters and ₹1 per 1,000 synthesized characters. Count provisional translation calls separately. OpenAI Realtime Translate lists $0.034 per audio minute. Its published targets include English and omit Telugu, while Telugu is a supported input. A direct or hybrid trial can therefore compare Telugu → English only on that provider. The app's existing OpenAI integration generates reports. [Sarvam prices](https://docs.sarvam.ai/api/getting-started/pricing) · [OpenAI model](https://developers.openai.com/api/docs/models/gpt-realtime-translate) · [Translation language coverage](https://developers.openai.com/cookbook/examples/voice_solutions/realtime_translation_guide)

LiveKit supplies WebRTC tracks and subscriptions. The STREAM-01 group mode uses the LiveKit browser and Node RTC SDKs with a separate media service. A server interpreter subscribes to individual microphone tracks and reuses the Saaras, Mayura and Bulbul pipeline. [LiveKit track model](https://docs.livekit.io/intro/basics/rooms-participants-tracks/tracks/)

**Last documentation check:** 2026-11-21. These are recommendations and documented API facts, **not proof credentials or integration work**.

## Stack decision
| Layer | Choice | Why / constraint |
|---|---|---|
| Web UI | Next.js App Router + TypeScript strict | One codebase for UI and server adapters |
| UI components | Tailwind CSS + shadcn/ui (optional) | Fast accessible building blocks; avoid custom design system |
| Browser microphone | `MediaRecorder` + `getUserMedia` | Captures short deliberate turns; secure context (HTTPS/localhost) |
| Room updates | API polling every ~1–2s first | Reliable, trivial to inspect; Supabase Realtime P1 |
| Data | Supabase PostgreSQL | Relational turns/deliveries/report/evidence |
| Audio | Supabase private Storage buckets | Source and synthesized audio private; server-issued signed links |
| Speech-to-text | Sarvam `saaras:v4` REST | Native Telugu/English and code-mix; max 30s |
| Translation | Sarvam `mayura:v1` | `te-IN`↔`en-IN`; <=1000 characters/request |
| Text-to-speech | Sarvam `bulbul:v4-flash` REST | `te-IN` and `en-IN`, returns base64 audio array |
| Meeting intelligence | OpenAI structured JSON output or another schema-capable LLM | Validate returned JSON; use evidence ID constraints |
| Validation | Zod (or similar schema library) | Server input, provider response and report validation |
| Testing | Vitest + Playwright, two-device manual tests | High-level behavior seams, smoke tests |
| Deployment | Vercel or equivalent HTTPS Next.js host + Supabase | Confirm API timeouts, worker strategy and body sizes before locking |

## Sarvam confirmed specifics
- STT: `POST https://api.sarvam.ai/speech-to-text`; multipart; `api-subscription-key`; model explicitly `saaras:v4`; mode `transcribe` or `codemix` according to test; max 30 seconds. Browser `MediaRecorder` WebM may be accepted but test actual file types. Prefer converting to mono WAV/16kHz only if necessary.
- ASR glossary: v4 `keyterms` allows up to **50 terms**, max 64 chars each. Biases recognition, does not guarantee it. P1; avoid sending entire transcript as keyterms.
- Translation: `POST https://api.sarvam.ai/translate`; set `model='mayura:v1'`, `source_language_code` and `target_language_code`; Mayura input max **1000 characters**, supports English and Telugu. If source language detected ambiguously, ask or retry, don't confidently label it.
- TTS: `POST https://api.sarvam.ai/text-to-speech`; explicitly `model='bulbul:v4-flash'`, `language_code='te-IN'|'en-IN'`, and an appropriate verified v4 `speaker` ID. Response `audios` entries are base64 encoded; decode and save media file. REST text max 2500 chars. Native Telugu script preferred to romanized Telugu for generation.
- Do not assume voice IDs are portable between Bulbul v3 and v4. Run voice catalog smoke test.
- Costs, quotas, model availability, and rate limits depend on account/plan; check dashboard at build time. No invented pricing.

## First-hour provider smoke tests (blocking)
1. Confirm actual `SARVAM_API_KEY` and `OPENAI_API_KEY` (or selected LLM) in server environment.
2. Upload genuine consented 8–10s Telugu audio; inspect `saaras:v4` output and language code. Log real latency.
3. Translate Telugu output to English using Mayura, compare to human ground truth for names and numbers.
4. Generate English audio with a v4 speaker and play it in browser.
5. Repeat English→Telugu, confirm **Telugu script TTS** and intelligibility.
6. Validate rate limits and all formats with the intended hosting platform.
7. Only then build UI and persistence. If one fails, use honest text-translated voice-note mode while resolving blocker.

## Provider timeout/fallback policy
- Stage timeout must be explicit and configurable; e.g., 20s per vendor request is a proposed initial upper bound, verify actual performance.
- On STT failure: preserve original; show retry; optionally use a validated alternate STT provider in a compatible adapter.
- On translation failure: show transcript + original audio and unavailable translation; do not generate guessed text.
- On TTS failure: show translated text and enable manual retry of voice generation.
- On LLM/report failure: show timeline; let user retry report generation; no placeholder fabricated agreement.
- A fallback provider must pass a bilingual smoke test first. Provider interchangeability is a code interface, not guaranteed model equivalence.

## Important browser constraints
- `getUserMedia` requires permission and HTTPS or localhost.
- Browser audio auto-play may require prior user interaction; enable playback manually on recipient join if needed.
- Different devices produce different `MediaRecorder` MIME types; select supported type with `MediaRecorder.isTypeSupported`, confirm with real STT upload.
- Do not transmit whole meeting as one large audio blob; each turn carries its own attribution and limit.

## Sources
1. Sarvam models and language table: https://docs.sarvam.ai/api/getting-started/models
2. STT REST and length/format limits: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api
3. Keyterm prompting: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/how-to/keyterms
4. Mayura translation: https://docs.sarvam.ai/api/api-guides-tutorials/models/mayura
5. Translation API: https://docs.sarvam.ai/api-reference/text/translate-text
6. Bulbul v4 API: https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/rest-api
7. Bulbul model, voices/limits: https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul
8. LiveKit React room (future): https://docs.livekit.io/reference/components/react/component/livekitroom/
9. Matt Pocock's official skills repo: https://github.com/mattpocock/skills
