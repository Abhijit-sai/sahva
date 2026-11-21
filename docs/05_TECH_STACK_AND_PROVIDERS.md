# Technology Stack and Provider Validation

## Provider decision for this release · 21 November 2026

Keep the installed fetch/WebSocket integration. Saaras v4 accepts base64 mono linear16 and sends partial/final events. Mayura v1 accepts up to 1,000 characters for both directions. Bulbul v4 Flash supports language-specific personas, REST WAV and streaming transports. Benchmark first playable PCM against the full WAV at identical text and voice. Recheck the account's quota and persona catalog before a live run. [ASR protocol](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming) · [Translation](https://docs.sarvam.ai/api-reference/text/translate-text) · [Bulbul](https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul)

At published pay-as-you-go rates, estimate ₹0.49 per ASR minute, ₹2 per 1,000 translated input characters and ₹2 per 1,000 Bulbul v4 Flash synthesized characters. Count provisional translation calls separately. OpenAI Realtime Translate lists $0.034 per audio minute. Its published targets include English and omit Telugu, while Telugu is a supported input. A direct or hybrid trial can therefore compare Telugu → English only on that provider. The app's existing OpenAI integration generates reports. [Sarvam prices](https://docs.sarvam.ai/api/getting-started/pricing) · [OpenAI model](https://developers.openai.com/api/docs/models/gpt-realtime-translate) · [Translation language coverage](https://developers.openai.com/cookbook/examples/voice_solutions/realtime_translation_guide)

LiveKit supplies WebRTC tracks and subscriptions. The STREAM-01 group mode uses the LiveKit browser and Node RTC SDKs with a separate media service. A server interpreter subscribes to individual microphone tracks and reuses the Saaras, Mayura and Bulbul pipeline. [LiveKit track model](https://docs.livekit.io/intro/basics/rooms-participants-tracks/tracks/)

The standalone Gemini Developer API trial authenticated the dedicated model and produced concurrent English and Telugu audio. The candidate failed the semantic acceptance gate. Sarvam remains the production meeting provider. [Measured comparison](../qa/S2ST_BENCHMARK.md) · [Experimental ADR](adr/0006_gemini_live_translate.md)

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

## Translation lab providers · 21 November 2026

The running selector is the existing loopback listening demo. It uses the server registry in `scripts/s2st/catalog.ts`. Entries contain the lab-supported subset of the provider's languages. Four languages can appear in the lab: English, Telugu, Hindi and Spanish. A valid pair requires a different source and target, support on the respective sides, and configured server credentials. An initial trial can test access when the direction has no audio receipt. Prior successful output is labeled as such. Live account limits and language quality require testing. The public meeting retains its English/Telugu contract.

| Engine | Protocol and controls | Access, limits and evidence |
| --- | --- | --- |
| Sahva Standard | Production Saaras v4 STT → Mayura v1 → Bulbul v4 Flash, via the existing isolated baseline harness. Streams interim ASR; completed phrases produce translated text and WAV with a language-specific persona. | `SARVAM_API_KEY`. Local baseline exercises English/Telugu. The service documents Hindi support; the production-shaped adapter and room schema currently cover English/Telugu only. See pricing above. [Model catalog](https://docs.sarvam.ai/api/getting-started/models) |
| OpenAI | `gpt-realtime-translate`, bearer key, `wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate`. PCM16 mono at 24 kHz both ways. Request source transcription with `gpt-realtime-whisper`. Process separate source, target and audio deltas. Send `session.close` and await `session.closed`. Source auto-detected; target explicit. No voice or glossary control exposed in the dedicated session configuration. | `OPENAI_API_KEY`. Telugu is an input. Spoken targets include English, Hindi and Spanish. Telugu output is unavailable. Published translation rate $0.034/audio minute, with account-tier limits and separate optional source transcription pricing. [Wire protocol](https://developers.openai.com/api/docs/guides/realtime-translation) · [Languages](https://developers.openai.com/cookbook/examples/voice_solutions/realtime_translation_guide) · [Pricing and limits](https://developers.openai.com/api/docs/models/gpt-realtime-translate) |
| Google | `gemini-3.5-live-translate-preview`. Existing Google WebSocket with server key, 16 kHz PCM in, 24 kHz PCM out, input/output captions, source hint and target echo. Preserve reporting-period instruction for English → Telugu only. See ADR-0006 for glossary, quota and lifecycle. | `GEMINI_API_KEY`. Telugu, Hindi, English and Spanish are listed. Account succeeded on the four primary directions. Exact-input ending errors persist. [Live Translate](https://ai.google.dev/gemini-api/docs/live-api/live-translate) |
| Alibaba | `qwen3.8-livetranslate-flash-realtime`. Region-scoped Model Studio WebSocket on the workspace hostname, Bearer authentication, 16 kHz mono PCM in, 24 kHz out. Target explicit, source automatic. Source ASR, translated text and speech. Adapter uses preset Tina with cloning disabled and drains `session.finish` through `session.finished`. Provider offers hotwords. | `DASHSCOPE_API_KEY`, `DASHSCOPE_WORKSPACE_ID`, `DASHSCOPE_REGION` (Singapore or Beijing). English, Hindi and Spanish support spoken output; Telugu is absent from the published list. Singapore lists $7.50/M audio input, $20/M text output, $30/M audio output and limits of 10 RPM/100k TPM. Protocol tested locally with simulated events; account access pending. OpenRouter's public catalog returned 476 models and zero Qwen LiveTranslate matches. [Protocol and languages](https://www.alibabacloud.com/help/en/model-studio/qwen3-5-livetranslate-flash-realtime) · [Model rates](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-livetranslate-flash-realtime) · [OpenRouter catalog](https://openrouter.ai/api/v1/models) |
| Microsoft (research) | Live Interpreter via Azure Speech SDK and resource-specific universal v2 speech endpoint, using `SPEECH_KEY` and `SPEECH_ENDPOINT`. Speech recognition, translated text, speech synthesis and prebuilt voices. Enhanced LLM language coverage and spoken target-voice coverage differ. | Regional resource, rates, voice/locale coverage and quota need account validation. No adapter selected. [Interpreter](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-use-live-interpreter) · [Language tables](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support) |
| ElevenLabs (research) | Enterprise alpha Eleven Realtime Translation, default Eleven v4 Turbo. `wss://api.elevenlabs.io/v1/translation/realtime`, server `xi-api-key`, original interim/final transcripts, translation and generated audio, explicit end-of-stream. Voice and eagerness controls. | Needs enterprise access, permitted target/voice, price and limits from account. No adapter selected. Offline dubbing is a separate product. [WebSocket reference](https://elevenlabs.io/docs/api-reference/realtime-translation/v-1-translation-realtime) · [Availability](https://elevenlabs.io/blog/realtime-translation) |

The lab caps inputs at 25 seconds and bounds session setup and draining. Long-session durations, reconnect behavior, and actual account throughput for new providers have not been measured. One trial does not qualify a provider for adoption. Each result retains the model identifier the API accepted. Provider aliases may change upstream.


## Experimental checkpoint inventory · 21 November 2026

| Stage | Candidate | Evidence and eligibility |
| --- | --- | --- |
| English → Telugu MT | ai4bharat/indictrans2-en-indic-dist-200M | Hub SHA `2cfd0a20057756d756bf3e53528f492afc52f91a`, MIT metadata, gated |
| Telugu → English MT | ai4bharat/indictrans2-indic-en-dist-200M | Hub SHA `d66a2122ad6d28184f3dc3797b652bd80ae3f65f`, MIT metadata, gated |
| TTS | maya-research/maya2-native | Hosted preset-voice smoke completed in Telugu and English. The model card at `87a83efdd6551e038246b6b37836a6264713eec3` lists Apache-2.0 with upstream notices, 12 languages and a reference CUDA 12.8 runtime. The Sreekar preset lists English and Telugu. See QA for the Studio quota and timing. Independent hosting, concurrency and listener qualification remain open. [Checkpoint](https://huggingface.co/maya-research/maya2-native/tree/87a83efdd6551e038246b6b37836a6264713eec3) · [Engine](https://github.com/MayaResearch/maya2-native) |
| ASR | IndicConformer / Bodhan Indic-Transcribe | Select exact checkpoint only after ASR error attribution. Verify native streaming separately. |
| Other MT and direct speech | bodhan-ai/indic-translate, SeamlessStreaming, Hibiki | Research backlog. Review upstream rights and Telugu speech directions for each. |

Use official IndicProcessor with eng_Latn and tel_Telu. Private server transport, batch one and a 24 GB test machine are proposed. Account access, actual VRAM and Sahva quality require a run.

The isolated service source is under services/indictrans2. Its Linux lock targets Python 3.11, Torch 2.6.0 / CUDA 12.4, Transformers 4.51.3 and IndicTransToolkit 1.1.1. On 21 November 2026 authenticated downloads verified both pinned revisions, including each safetensors SHA-256. Both directions generated text offline on CPU in FP32. The worker reports the selected device, thread count, dtype and beam count on each translation receipt. CPU timings apply to the tested hardware. CUDA execution, human comparison and room eligibility remain separate qualification steps.

### Three-language LiveKit demo candidate

Group meetings accept English, Telugu and Hindi. Saaras v4 transcribes each microphone. Sarvam Translate v1 translates each utterance directly for each distinct listening language. English and Hindi use Bulbul v4 Flash. When a meeting includes a Hindi speaker or listener, Telugu speech is assigned to Maya 2 Native's Sreekar preset. The operator rejected both Pooja and Kavitha for the demo. Sreekar requires a reachable, authenticated private service. When Sreekar is unavailable the authorized substitute is Sarvam Tarun (tarun_te_narration). The listener sees the actual Telugu voice name. The existing two-person phrase flow and historical Mayura comparison keep their model configuration. Post-call reports remain available in English and Telugu.

Configure the server-only MAYA_NATIVE_SPEECH_URL and MAYA_NATIVE_TOKEN for a private authenticated HTTPS proxy to the native WAV endpoint. Do not point it at the public Studio or Maya's differently shaped hosted API. Require repeated real-room Telugu playbacks before claiming Sreekar is ready.
