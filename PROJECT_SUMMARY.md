# Sahva — Append-only Project Summary

**Purpose:** Persist verifiable status across coding-agent chats, phase handoffs, context resets and buildathon time constraints. Read the **newest entry at the end** before work. This is not a PRD. For the update template and minimum evidence, see `agent/PHASE_UPDATE_TEMPLATE.md`.

---
## [2026-11-21 10:16 IST — Planning baseline] — Phase 0: Documentation — PRE-BUILD

**Reporter:** ChatGPT planning session  
**Actual repo/branch/HEAD:** No application repository was provided or inspected. All values unknown.  
**Upstream:** Unknown  
**Working tree:** Not inspected  
**Tickets:** SB-00 onward prepared, no tickets verified DONE  
**Status:** PRE-BUILD; DOCUMENTATION PREPARED ONLY  
**Timebox:** 12-hour buildathon requested; exact clock start/end and remaining time unverified

### Objective and user-visible result
- Created Sahva project documentation pack based on agreed product conversation.
- Working application: **NOT BUILT**.
- Live audio-room functionality: **NOT BUILT**.
- Sarvam/LLM integration: **NOT TESTED**.
- Actual browser demo and deployment: **NOT PERFORMED**.

### Locked product framing
- Brand working name: **Sahva** (trademark/domain unverified).
- Two-person turn-based audio room; no video, telephony, WhatsApp or simultaneous continuous voice in P0.
- Each participant selects Telugu/English listening language and explicitly consents.
- Source and translated voice replay in right-side timeline with transcript toggle.
- One canonical evidence-linked meeting record localized per participant; proposed versus agreed commitments distinguished.
- Original voice immutable; transcript corrections are versioned.

### Implementation evidence
- Planning artifacts in pack root/docs/agent/ops/qa.
- Files changed in user's actual repo: **NONE** (no repo access established).
- Database migrations: **NONE**.
- Provider API calls: **NONE**.
- Deployment URL: **NONE**.
- Git commits: **NONE**.

### Test evidence
| Command / test | Result | Notes |
|---|---|---|
| Real Telugu STT/translation/TTS | NOT RUN | API credentials needed |
| Real English STT/translation/TTS | NOT RUN | API credentials needed |
| Two-browser join/record/play | NOT RUN | No app repo |
| Room privacy and consent | NOT RUN | Docs only |
| Bilingual meeting summary | NOT RUN | Docs only |

### Decisions and deviations
- Accepted planning ADRs: `docs/adr/0001_turn_based_room.md`, `docs/adr/0002_canonical_meeting_record.md` (provisional until team approval).
- **Design refinement:** For the first 12-hour build, use a browser turn-room with short polling; full LiveKit voice tracks are a future phase. This must be surfaced plainly to the user; it is not a production open-mic call.

### Risks and blockers
- [BLOCKER for integration] Active Sarvam API key, verified voice ids and actual bilingual smoke test.
- [BLOCKER for code] Exact repo path/branch and source inspection.
- [BLOCKER for deploy] Hosting, Supabase project and server worker runtime confirmation.
- [OPEN] Event judging category and precise cutoff; current budget and network conditions.

### Next agent / next phase
1. Obtain real repo path and inspect full git state without mutation.
2. Read `AGENTS.md`, the canonical docs and this newest project-summary section.
3. Start SB-00: run actual bilingual provider tests on consented clips.
4. Log measured behavior and selected fallback before building room UI.
5. Append the first factual phase update using the template; never rewrite this pre-build record as implementation evidence.

---
## [2026-11-21 11:30 IST] — Phase 0: Provider and environment proof — PARTIAL

**Reporter:** Codex  
**Actual project/branch/HEAD:** D:\Develop\Builders 2026\sahva_project_pack / no Git repository / none  
**Upstream and working tree:** unavailable. The initial directory contained 24 planning documents and no application files.  
**Ticket:** SB-00 | **Deadline:** approximately 12 hours from kickoff, exact cutoff unknown.

### Objective and user-visible result
A server-only CLI validates two local clips, exercises both real Sarvam directions when configured, writes privately reviewable WAV/text and redacted stage receipts, and reports the missing inputs before transmitting anything.

### Implementation evidence
Added package.json/lock, tsconfig, ESLint and Vitest configs, .gitignore, .env.example, lib/providers/sarvam.ts, scripts/speech-smoke.ts and tests/speech.test.ts. Rechecked Sarvam REST contracts and v4 voice catalog; selected simran_en_customer and pooja_te_conversation pending listening tests. Node 24.13.0, npm 11.6.2, Next 16.4.6. No migrations applied, live API calls, deployment, or commits.

### Test evidence
| Command | Result |
| --- | --- |
| npm test | Initially failed before adapter existed. Subsequently 7 simulated contract tests passed, including both directions and invalid responses. |
| npm run typecheck | Passed. |
| npm run smoke:speech | Exited 1 before networking. No key, consented clips or explicit smoke consent. |
| docker info | Local Docker engine unavailable. |

### Decisions, blockers and next phase
ADRs 0001/0002 confirmed by the current brief. WBS phase numbers take precedence for ticket tracking. Gate 0 remains open. Work on original-only persistence, consent and private replay is independent of speech credentials, as allowed by the documented failure fallback. Use an explicitly labeled single-process development PostgreSQL runtime to exercise real SQL locally; production remains on Supabase. Next SB-01: two independently authorized seats. Preserve all planning history. Required inputs: SARVAM_API_KEY, consented Telugu/English audio, hosted Supabase and hosting access, OPENAI_API_KEY. No staging, deployment or linguistic verification implied.

---
## [2026-11-21 11:44 IST] — Phase 1: Two consented seats — VERIFIED LOCALLY

**Reporter:** Codex | **Project:** D:\Develop\Builders 2026\sahva_project_pack | **Git:** no repository, branch, HEAD, upstream, staged/unstaged/untracked counts or commits | **Ticket:** SB-01 | **Overall status:** PARTIAL | **Deadline:** unknown.
### Result and implementation
App Router create/join screens, separate speak/listen choices, signed expiring HttpOnly room sessions, hashed fragment invitation, two constrained seats, presence polling and versioned consent. Files include app/{layout,page,style,room,api}, components/{entry,workspace,client}, lib/{shared,server/db,server/rooms}, next.config, playwright.config, tests/browser/room.spec.ts, supabase/migrations/001_rooms.sql and npm lockfile.
### Evidence
- npm run test:browser passed 1 Chrome test (14.1s). Two isolated profiles joined, refresh preserved identity, stranger GET 401, third join 409, withdrawing consent disabled recording. The initial run caught an origin/host mismatch; corrected and reran.
- npm run typecheck and npm run lint passed. Local SQL migrated through PGlite; hosted Supabase has not been provisioned. No deployment.
- SB-00 follow-up: Sarvam and OpenAI environment entries present. Sarvam real translation and synthesis returned HTTP 403, provider code invalid_api_key_error for synthetic test text. No translated speech received. User informed. No human clips supplied or transmitted.
### Decision and next task
Use explicit SAHVA_LOCAL=1 for local DB/private files, disallowed in production. Production uses server-side PostgreSQL transactions with Supabase Storage. Add DATABASE_URL to hosting configuration. Both ADRs preserved. SB-02: record on A and replay B after refresh and a downstream failure. Hosted verification and two physical devices outstanding. Existing planning history preserved.

---
## [2026-11-21 11:48 IST] — Phases 2–3: Original replay and bilingual provider proof — PARTIAL

**Reporter:** Codex | **Project:** D:\Develop\Builders 2026\sahva_project_pack | **Git:** no repository, branch, HEAD, upstream or diff counts | **Tickets:** SB-00, SB-02, SB-03, SB-04, SB-08 | **Deadline:** exact time unknown.
### User-visible result
A speaker can record, preview, discard or submit. Both profiles can replay the private original and see stage errors. Speech stages persist individually with an expiring claim, one retry, separate ASR and revisions; synthetic output uses versioned objects. Independent source/translated details, polling and original/AI playback are wired up.
### Implementation evidence
Added lib/server/{audio,storage,turns}, components/{recorder,turn-card}, supabase/migrations/002_turns.sql, supabase/storage.sql, scripts/synthetic-speech-proof.ts. Updated room route, workspace, browser suite and runtime configs. No Git commits. Local database migrations executed. Hosted Storage credentials verified read-only; service key and URL populated. Direct PostgreSQL hostname returned ENOTFOUND; asked for the project's Session pooler URI. No hosted migrations or deployment yet.
### Tests and live calls
- npm run test:browser — 2 passed in 24.0s. Chrome fake-device MediaRecorder created actual WebM bytes. Second session played original after refresh, retrieved byte-identical data after one STT failure/retry, and a stranger received 401. Local DB/storage, no live vendor used in this test.
- node --env-file=.env.local scripts/synthetic-speech-proof.ts — updated key successful. Real Sarvam calls using synthetic test speech. Telugu to English: 8.64s input, stages 1033/904/1871 ms, 5.92s decoded WAV. English to Telugu: 6.8s input, 953/775/2546 ms, 8.8s decoded WAV. Private redacted receipts .sahva/speech-jrBgqI/evidence.json. This corrects the earlier credential blocker. Human recordings and fluency evaluation pending.
- node --env-file=.env.local scripts/report-smoke.ts — OpenAI accepted synthetic two-turn input; three canonical items and three Telugu strings, no invented deadline or unaccepted Sarah owner on this case.
### Decisions and next phase
FFmpeg validates actual submitted clip duration including WebM without duration headers. Each browser-triggered stage runs within an awaited request; a later poll can resume from persisted state. No live provider promise runs after the request returns. Production remains Supabase-only. Next: end-room transactions, report projection and full two-profile test with real providers. Speaker corrections after end are currently locked; raw recordings are never replaced. All baseline documents preserved.

---
## [2026-11-21 12:12 IST] — Phases 3–5: Live room, reports and release packaging — PARTIAL

**Reporter:** Codex | **Project/branch/HEAD:** D:\Develop\Builders 2026\sahva_project_pack / main / unborn before initial commit | **Upstream:** origin configured for the user-supplied GitHub repository, verified empty by git ls-remote. **Working tree:** new implementation and original pack pending first commit; no pre-existing Git changes. **Tickets:** SB-00, SB-03 through SB-08. **Cutoff:** unknown.

### User-visible result and evidence
- Both speakers explicitly authorized four supplied recordings for Sarvam and their transcripts for OpenAI. All four private phone AAC/MP4s decoded, 9.919–11.369 seconds. A pipe-only decoder initially rejected the phone files; a seekable private temporary input fixed receipt of the exact original bytes. The first pair’s outputs were decoded as playable 5.28s English and 9.84s Telugu WAVs. Most recent direct human-input receipts are in the ignored local smoke directory.
- Live two-profile Playwright test with four actual recordings and real Sarvam/OpenAI passed in 50.4s after conservative report fixes. Four exact originals persisted, four synthetic translated voices played in the opposite session, duplicate submissions returned the same turn, refresh retained all four, speaker revision regenerated a delivery, guest end was refused and owner end was idempotent. Three canonical items had matching metadata/evidence in both languages. This used local PGlite/private files, two browser contexts on one computer and existing recordings.
- Earlier live tests rejected invalid model status/acceptance/evidence. Classification now determines status server-side, evidence IDs are constrained to the actual turn set, absent verbatim acceptance excludes a claim and a semantic review checks candidate support. Proposed actions have no assigned owner. Localization accepts only strings keyed by canonical IDs. Latest ambiguity fixture passed with four items in both languages, unknown deadlines and an omitted unaccepted owner.
- Supabase verified both configured private buckets through its real API. Direct DB host failed ENOTFOUND. Shared hosted migrations remain unverified pending a reachable Session pooler or appropriately connected host. No physical two-device test, native-speaker quality rating or EC2 deployment claimed.

### Files and decisions
Added lib/providers/meeting, lib/server/reports and recording, components/report, scripts/{setup-supabase,report-smoke}, migrations 003–004, readiness and health endpoints, tests/report.test.ts, tests/live/conversation.spec.ts and tests/browser/guards.spec.ts. Updated room controls, recorder, API routes, dependency lock and configs. Added .dockerignore, Dockerfile, .gitattributes, .github/workflows/deploy.yml, ops/aws/*, ops/AWS_DEPLOYMENT.md, ops/LOCAL_DEVELOPMENT.md and ADR-0003. Updated README and architecture, API and WBS docs. Releases are built from main and pulled by an existing x86-64 EC2 server via systemd. Secrets and personal media stay out of Git and public artifacts.

### Remaining work
Verify the published CI release, reach the Supabase database, configure the named existing EC2 host and trusted HTTPS, then run a fresh physical two-device acceptance and fallback capture. Inspect ops/AWS_DEPLOYMENT.md and the newest ledger entries before deployment. The intended instance ID/name and public HTTPS name are outstanding. No destructive actions or new billable AWS resources. Preserve the original documentation history.
