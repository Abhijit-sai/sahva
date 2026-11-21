# Proposed API, State and Event Contracts

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

