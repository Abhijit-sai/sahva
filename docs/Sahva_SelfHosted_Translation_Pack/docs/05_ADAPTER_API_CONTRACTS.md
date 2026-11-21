# 05 — Self-hosted API and internal provider contracts

**Design proposal — not implemented.** Match repo conventions and version fields after inspecting active code. These contracts aim to connect Python GPU workers to Sahva's existing Node `LiveKit → live.ts → turns.ts` pipeline without exposing secrets to clients.

## Capability registry
```ts
type Language = 'te-IN' | 'en-IN' | 'hi-IN';
type EngineCapability = {
  id: string;                    // selfhost-indictrans2-mt, selfhost-maya-tts
  stage: 'asr' | 'mt' | 'tts' | 'direct-s2st';
  modelRevision: string;         // immutable HF SHA/release
  sourceLanguages: Language[];
  targetLanguages: Language[];
  streamInput: boolean;
  streamOutput: boolean;
  supportsInterim: boolean;
  voices?: string[];
  ready: boolean;
  experimental: boolean;
  restrictions?: string[];
};
```
Model names appearing in a config file do not prove readiness. Use actual authenticated worker health and model smoke results; registry truth is server-controlled.

## Stage provider ports
```ts
type Timing = {
  receivedAtMonotonicMs: number;
  committedAtMonotonicMs?: number;
  firstOutputAtMonotonicMs?: number;
  finishedAtMonotonicMs?: number;
};

type Segment = {
  roomId: string;
  speakerId: string;
  segmentId: string;
  sourceLanguage: Language;
  startOffsetMs: number;
  endOffsetMs: number;
  revision: number;
  text: string;
  finalized: boolean;
  protectedSpans?: { kind: 'name'|'number'|'date'|'negation'|'term'; surface: string }[];
};

type MTResult = { segmentId: string; engineId: string; modelRevision: string;
  sourceLanguage: Language; targetLanguage: Language; translatedText: string;
  warnings: string[]; timing: Timing; requestId: string; };

type TtsChunk = { requestId: string; seq: number; pcm: Uint8Array;
  sampleRate: number; channels: 1; final: boolean; };

interface TranslationAdapter {
  capabilities(): Promise<EngineCapability>;
  translate(segment: Segment, target: Language, signal: AbortSignal): Promise<MTResult>;
}
interface SpeechSynthesisAdapter {
  capabilities(): Promise<EngineCapability>;
  streamSpeech(input: {text: string; language: Language; voice: string; requestId: string},
    signal: AbortSignal): AsyncIterable<TtsChunk>;
}
```
Do not force a batch text translator to pretend it streams tokens. Stage composition is permitted; direct S2ST has a separate adapter contract if ever needed.

## Worker REST endpoints (internal-only)
- `GET /v1/capabilities` returns immutable engine IDs, supported language/voice and readiness.
- `POST /v1/mt/translate` accepts *finalized* text segment, source/target IDs, glossary/protected spans and timeout; returns translated text, revisions and stage timings.
- `POST /v1/tts/synthesize` with `stream=true` returns `audio/pcm` chunks or a WebSocket stream negotiated by protocol version; no base64 WAV blob per chunk if avoidable.
- `GET /live` and `GET /ready` are separate.
- `GET /metrics` is private and does not include transcripts or arbitrary PII.

### Example MT request
```json
{
  "requestId": "2b2df87b-e0d3-47cb-abd2-864bf53a4a53",
  "segmentId": "segment-001",
  "sourceLanguage": "te-IN",
  "targetLanguage": "en-IN",
  "text": "సోమవారం లోపు పంపకండి.",
  "model": "selfhost-indictrans2-indic-en-dist-200M",
  "glossaryVersion": "room-glossary-3",
  "protectedSpans": [{"kind":"negation","surface":"పంపకండి"}],
  "deadlineMs": 3500
}
```
Example semantically means *do not send by Monday*; that's illustrative fixture input, not an evaluated output. Critical negation mismatch should be flagged, not silently normalized.

### Example MT result
```json
{
  "requestId": "2b2df87b-e0d3-47cb-abd2-864bf53a4a53",
  "segmentId": "segment-001",
  "modelRevision": "HF_SHA_REQUIRED",
  "translatedText": "Do not send it by Monday.",
  "warnings": [],
  "elapsedMs": 0
}
```
`elapsedMs: 0` is a **schema placeholder**, never a performance result. Real observations must be written by measured instrumentation.

## Event lifecycle
```text
source.speech_started
source.caption_partial             # provisional, replaceable
source.caption_committed           # stable segment
translation.started
translation.ready                  # may raise critical_fact_warning
synthesis.started
synthesis.audio_chunk(seq=0..n)
synthesis.finished
listener.playback_started
listener.playback_finished
segment.archived
```
Each event includes `roomId`, `speakerId`, `segmentId`, `engineId`, `modelRevision`, and a bounded timestamp. Store media as source/translation provenance with current room access rules. Only listener-permitted output is broadcast.

## Race/idempotency invariants
- `(room, speaker, segment, stage, engine revision, target, voice)` identifies replay-safe work.
- On transcript revision, dependent outputs become `stale`; never mutate original captured audio.
- Consent epoch mismatch cancels all work for that epoch; worker must not continue producing output to client.
- If the user changes model mid-meeting, commit pending utterance or mark incomplete; only future segments use new engine.
- Stage-specific timeouts and provider errors must not be conflated with packet loss or a browser autoplay restriction.

## Auth and network boundary
Use a server-to-server credential (rotated bearer token/mTLS) and private network restriction. Workers reject requests from browsers, unknown room-scoped account, unauthenticated/cross-room requests, oversized audio, unexpected URLs and unsupported model IDs. Secrets remain environment-only. Voice-cloning payloads require separate explicit consent and an additional policy.

## Integrating with current repository
- `lib/providers/sarvam.ts`: keep unchanged as much as possible; implement small adapters wrapping it.
- `lib/server/meeting.ts`: leave microphone track subscription and participant identity intact; inject stage router through a narrow server-side interface.
- `lib/server/live.ts`: keep capture and ASR partial behavior; optionally swap downstream translation on **finalized/stable** segments first.
- `lib/server/turns.ts`: inject MT/TTS on persisted processing stages after benchmarking; retain source-id/revision checks.
- `scripts/compare-directions.ts`: extend to parameterized provider/stage fixtures, emitting standardized benchmark JSON.
- Add a separate internal admin/test UI route with selectable **stages**, target languages, pinned model revisions and consented WAV fixtures.
