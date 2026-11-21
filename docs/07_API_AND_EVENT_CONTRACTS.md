# Proposed API, State and Event Contracts

## Speaker choice

Room creation/join can return the authenticated participant ID, already present in the room snapshot. A manual upload or live finish may include a synthetic voice ID. Validate it against the server-derived target on archive. Missing values resolve the pre-existing language voice. Store the chosen persona with the turn before TTS so the listener's browser may perform processing after the speaker disconnects. The synthetic persona has no role in meeting extraction.

## Implemented live lifecycle and extension boundary

The authenticated room routes use live/start, frame, interpret and finish. Start takes the recording lease. Frame validates ownership, sequence and byte limits. The polled timeline carries provisional/final captions and optional draft translation. Finish binds the original and final text to an idempotent turn. The existing processing stages expose translation, TTS, ready and retryable failure. Media retrieval requires the participant session. Playback start/end are listener events. Offline/page hide, consent withdrawal and explicit mute release capture. Reconnect requires a fresh gesture.

For the directional experiment, scope speech detection, partial/final, translation revision, audio segment, playback/cancellation and error to speaker, stream generation and ordered segment. Ignore duplicate frames and stale generations. Display drafts immediately, queue only stable translations, and archive the associated source before admitting evidence to meeting intelligence. Expose incomplete or cancelled turns distinctly. These are proposed semantics for the experiment.

> **Design proposal**, not deployed contract. Prefix routes with `/api/v1`. Validate request/response with a shared schema. All state-changing endpoints require room-scoped participant token and idempotency key where noted. JSON examples contain placeholders.

## Authentication and scope
Room creation returns an owner-scoped opaque participant token and a separate shareable invite secret (must not share owner privileges). Join consumes invite secret and returns scoped participant token in an httpOnly secure cookie when feasible; a CSRF strategy is mandatory if cookie auth. API validates token signature, expiration and room/member binding on every request. A join token is not a permanent account login.

## Endpoints

| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/rooms` | Create room and owner participant |
| POST | `/api/v1/rooms/:roomId/join` | Join with invite + name/language + consent |
| GET | `/api/v1/rooms/:roomId` | Room participants, status, permissions |
| POST | `/api/v1/rooms/:roomId/consent` | Explicit scoped consent; versioned timestamp |
| POST | `/api/v1/rooms/:roomId/turns` | Upload recording + idempotency key, enqueue processing |
| GET | `/api/v1/rooms/:roomId/timeline?afterSeq=N` | Incremental turns and delivery states |
| POST | `/api/v1/rooms/:roomId/turns/:turnId/retry` | Retry selected failed stage |
| POST | `/api/v1/rooms/:roomId/turns/:turnId/revisions` | Correct transcript and invalidate dependent output |
| GET | `/api/v1/rooms/:roomId/media/:turnId?kind=original` | Authorized short-lived signed URL |
| GET | `/api/v1/rooms/:roomId/media/:turnId?kind=translation&lang=en-IN` | Authorized translated-audio URL |
| POST | `/api/v1/rooms/:roomId/end` | Owner ends, idempotent, starts summary |
| GET | `/api/v1/rooms/:roomId/report?lang=en-IN` | Canonical report localized for participant |
| POST | `/api/v1/rooms/:roomId/report/retry` | Retry a failed report generation |
| DELETE | `/api/v1/rooms/:roomId` | Purge room if tested/authorized; otherwise do NOT expose |

## Key payloads
### Create room
```json
POST /api/v1/rooms
{"title":"Weekly Dispatch","ownerName":"Ravi","listeningLanguage":"te-IN","consentVersion":"2026-11-21-v1","acceptedConsent":true}

201
{"roomId":"uuid","ownerParticipantId":"uuid","inviteUrl":"https://your-host/room/uuid?invite=opaque","status":"active"}
```
The owner token is set as an httpOnly cookie or returned via a secure transport policy. Never embed it in shared invite URL.

### Upload turn
`multipart/form-data` fields: `audio`, `durationMs`, `idempotencyKey`, optional `declaredSourceLanguage` (`auto|te-IN|en-IN`). Enforce size cap (proposal <=10MB) and server-side max 30s; P0 UI stops at 25s.

```json
202
{"turnId":"uuid","turnSeq":3,"status":"uploaded","retryable":false}
```
Duplicate `(roomId,participantId,idempotencyKey)` returns the same `turnId` and stable result, not a duplicate row.

### Timeline response
```json
{
  "roomId":"uuid","roomStatus":"active","nextSeq":3,
  "turns":[{
    "id":"turn-uuid","seq":3,"speakerId":"participant-uuid",
    "sourceLanguage":"te-IN","durationMs":8700,"createdAt":"2026-11-21T06:15:00Z",
    "status":"ready","sourceTranscript":"...","currentTranscriptRevision":1,
    "originalAudioAvailable":true,
    "deliveries":[{"targetLanguage":"en-IN","translatedText":"...","translatedAudioAvailable":true,"status":"ready","sourceRevision":1}]
  }]
}
```
No global storage keys or cloud service credentials in response. Fetch signed URLs through authorized media route.

### Correct transcript
```json
POST /api/v1/rooms/:roomId/turns/:turnId/revisions
{"correctedText":"Guntur Sannam S4, twenty cartons","reason":"Product name misheard","expectedCurrentRevision":0}

201
{"revision":1,"affectedDeliveries":"stale","reportStatus":"stale"}
```
Concurrent revision uses compare-and-swap `expectedCurrentRevision`; conflict returns 409 with current revision metadata.

### End room
```json
POST /api/v1/rooms/:roomId/end
{"idempotencyKey":"uuid"}

202
{"roomStatus":"summarizing","reportStatus":"generating"}
```
If room has zero turns, return a valid empty report rather than fake summary. Only authorized owner can end.

### Report projection
```json
GET /api/v1/rooms/:roomId/report?lang=te-IN
{
  "recordVersion":1,"status":"ready","language":"te-IN",
  "summary":"...","decisions":[],
  "actions":[{"id":"uuid","description":"...","status":"proposed","ownerParticipantId":null,"dueDate":null,"evidenceTurnIds":["turn-uuid"]}],
  "openQuestions":[]
}
```

## Status and error codes
- 400 invalid request, unsupported MIME, bad language or invalid report output.
- 401 missing/expired participant token; 403 access denied/consent absent; 404 resource outside authorized room or missing; 409 room full/closed or optimistic concurrency conflict.
- 413 too-large file; 422 empty/unusable audio; 429 bounded rate limit; 503 provider temporarily unavailable.
- All errors: `{ "error": { "code": "STT_UNAVAILABLE", "message": "...", "retryable": true, "traceId": "..." } }`. Never include provider secret, entire transcript or audio URL in logs/errors.

## Client polling / UI events
For P0, `GET timeline` every 1–2s when page visible; avoid duplicate turn rendering via `turnId`. On focus/reconnect, perform full snapshot + delta. Optional P1 realtime channels: `turn.created`, `turn.stage_changed`, `delivery.ready`, `report.ready`, `participant.joined`, `room.ended`. They are notifications, not source of truth; clients always rehydrate by GET.

## Processing and idempotency
- `turn.uploaded` → `transcribing` → `transcribed` → `translating` → `ready`; delivery statuses separate.
- Persist original BEFORE vendor calls. If vendor fails, keep source with failed-stage code.
- Guard overlapping retries with transaction-level state claim or unique job key.
- `TranscriptRevision` invalidates dependent deliveries and cached report; never overwrite audio or ASR text.
- `report` generated once per source revision fingerprint; stale generation cannot overwrite newer revisions.
- Use request correlation ID across stages, store provider request IDs safely.

## Prohibited behavior
No unapproved implicit human names, no fake due date, no cross-room media access, no auto-public audio URL, no sending a message to a third party, and no `localStorage` of permanent API secrets.

## Implemented P0 client contract

The Next.js client and server use /api/v1/rooms. Create and join accept name, speakingLanguage, listeningLanguage, acceptedConsent, consentVersion, optional title and the invitation secret for join. A new invitation travels in the URL fragment. The API sets an HttpOnly, SameSite=Strict cookie scoped to that room’s API routes. POST requires the x-sahva-request header and checks the browser Origin. The consent endpoint accepts accepted plus consentVersion.

The timeline GET returns a bounded full snapshot (up to 60 turns), members, current participant and recording eligibility. This captures stage and revision changes for existing sequences. Upload deduplicates on idempotencyKey and returns id and seq. The server measures the audio itself. POST turns/{turnId}/process advances one persisted stage; retry resumes a failed stage. Media routes redirect to a short-lived private URL on Supabase. Local development returns authorized bytes directly.

End freezes new turns. POST report/generate or report/retry is an awaited, leased operation. GET report returns version, status, skipped-turn count and items in the requested language. Items have kind, status, stable ID, owner, ownerParticipantId, deadline and revision-specific evidence. The Telugu projection can only replace the prose field. A post-end speaker correction invalidates the report and increments its version.


## Live phrase extension

Authenticated POSTs under the existing room API use the same CSRF header. `live/start` acquires the microphone lease, verifies consent and opens the server-side provider session. It returns a phrase key. `live/frame` accepts that key, a zero-based sequence and base64 mono signed 16-bit PCM at 16 kHz. Repeat frames are ignored and out-of-order frames are rejected. `live/interpret` coalesces translation requests for changing captions. The timeline's optional `caption` contains the current speaker, source text, draft translation, target language and final flag while both members consent. `live/finish` accepts the key and an optional cancel flag. It saves one original WAV and the final transcript when available. Repeated finishes return the saved turn. Drafts never enter the meeting record.

## Cross-region capture

The live start route acquires the room lease and uses the authorized state returned by that same transaction for speaker and listener languages. The microphone keeps up to six seconds of onset audio locally while opening the lease. Frame uploads normally carry 200 ms and can combine two consecutive frames into a 400 ms message while a request is outstanding. Sequence numbers count HTTP messages. The relay still enforces its 16,000-byte limit and archives the exact PCM sequence. Backpressure beyond the bounded queue prompts the speaker to review the saved phrase. The listener can open Original on that message.

### Group meeting transport

Create with transport=livekit and the group disclosure version. POST /api/v1/rooms/{room}/meeting requires a signed member session, an active meeting and consent from all members. It returns a short-lived room- and identity-scoped LiveKit microphone credential and accepts an optional validated translated voice. The timeline includes a captions array for concurrent speakers, a phrase_id on archived turns and per-viewer target/text/audio selection. The original two-person response retains caption for existing clients.

## Loopback provider-evaluation protocol

The opt-in lab process serves a public-metadata-only catalog, allowlisted synthetic WAVs, and one origin-checked WebSocket session at a time on loopback. The session path carries the engine, declared source and spoken target. Unknown or unsupported combinations and missing configuration are rejected before opening a provider. After ready, the browser sends bounded mono 16 kHz PCM16 in order, then finish. The server sends separate caption, audio, interruption, error and completion events. A Sarvam source snapshot and an append-only provider delta have distinct update semantics. The comparison export contains source hash, model, settings, local timing observations and optional human review. Lab evidence has its own lifecycle outside the canonical meeting record.


## Experimental worker boundary

Server-only bearer-authenticated GET /live, GET /ready, GET /v1/capabilities and POST /v1/mt/translate. Supply requestId, sourceLanguage, targetLanguage and finalized text. Return requestId, translatedText, exact model and revision, and inferenceMs. Bound text at 1,000 Unicode code points. Reject unsupported pairs, overload, malformed inputs and expired jobs with a structured error code. Capabilities describe loaded models. A later streaming test must distinguish draft and committed source, first MT, first decodable audio, playback start and playback completion. Room events require epoch and revision checks before delivery.

The offline MT runner requires the worker to echo the request UUID and language pair and match the revision advertised in the authenticated capability response. New lab browser receipts include first source caption, first final source caption and the SHA-256 of the downloadable translated WAV. The existing source hash identifies decoded input PCM. Receipts from earlier runs may omit these fields.

The text-only engineering trial labels receipts `sourceKind=fictional-script`, records the exact input-text digest and uses a null PCM digest. Speaker-confirmed recordings require a PCM digest, verified references and processor consent. On CPU the worker returns `runtime.device=cpu`, `runtime.dtype=float32`, a null CUDA runtime and zero allocated GPU bytes.

### Three-language meeting candidate

The LiveKit room snapshots the other members' listening languages when it saves a turn. Each delivery belongs to its source turn, correction revision and target language. Timeline and translated-media responses use the requesting member's listening preference. Group drafts are also listener-specific. Same-language recipients replay the original. A missing Sreekar service routes Telugu synthesis to Tarun. The delivery records the actual output voice so the UI and rehearsal can distinguish the two. The report language contract continues to offer English and Telugu.
