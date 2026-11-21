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

---
## [2026-11-21 12:15 IST] — Phase 5: First GitHub release attempt — IN PROGRESS

**Reporter:** Codex | **Project:** sahva_project_pack | **Branch/HEAD:** main / fb6040fad316eb47fd26f3a35ea4efa03f39374e | **Upstream:** origin/main | **Ticket:** SB-07. The initial source commit reached the public repository. The working tree was clean immediately after push. The current patch changes only package-lock.json and this ledger.

### Evidence and decisions
- Initial release contents: 81 tracked files. Zero configured credential matches in staged blobs or generated browser assets; no private audio, test directories or environment file in the index.
- npm run lint, npm test (10 passed), npm run build and the final offline Chrome suite (3 passed in 20.0s) succeeded. Bash syntax check on ops/aws/update.sh passed. Local preview /api/ready returned HTTP 200.
- GitHub Actions run 44876820264 failed at npm ci on Linux, before any deployment, because npm 11.19.1 required two optional native-runtime lock entries absent from the Windows-generated lockfile. Repaired the lock in an isolated directory using that runner version. Linux-target npm ci --dry-run --ignore-scripts passed, with 420 dependencies planned.
- Next: publish and monitor the corrected build. EC2 host identity and reachable Supabase connection are still required for hosted release verification. No database migration or public HTTPS deployment claimed. Existing recordings and runtime credentials remain local.

---
## [2026-11-21 12:20 IST] — Phase 5: Linux CI and image startup — PARTIAL

**Reporter:** Codex | **Project/branch/HEAD:** sahva_project_pack / main / 86d9476 | **Upstream:** origin/main | **Ticket:** SB-07 | **Working tree:** workflow and ledger patch only. Exact event cutoff unknown.
GitHub run 44877066778 passed the complete Linux check job, including clean install, typecheck, lint, tests, Chrome and production build. Its publish job built the image and ran FFmpeg. The first HTTP probe raced container startup and curl exited 56 on TCP reset. Changed the probe to bounded retry for all transient errors and added container startup logs on exhaustion. No release or EC2 success claimed by this attempt. The workshop console reported zero Mumbai instances. Continue release verification and identify or authorize the intended target. Supabase use is restricted to the supplied Sahva settings, per the user's clarification.

---
## [2026-11-21 12:31 IST] — Phase 5 — Published image and fallback demonstration — PARTIAL

**Reporter:** Codex. **Repository:** sahva_project_pack. **Branch and implementation commit:** main / a6566ca6dd361cdf83136f1760304cf5f1c327cb. **Upstream:** origin/main. **Tickets:** SB-07, SB-08. **Deadline:** exact cutoff unknown. The working tree was clean at inspection. This documentation update changes ops/AWS_DEPLOYMENT.md and this ledger. All media, keys and local settings remain outside Git.

### Objective and implementation evidence
- GitHub Actions built and published the amd64 image and checksum. The public release API reported a 434,960,738-byte image and a 91-byte checksum file. [Release](https://github.com/Abhijit-sai/sahva/releases/tag/build-a6566ca6dd361cdf83136f1760304cf5f1c327cb)
- Added fresh-instance selection, SSH restrictions, encryption, post-launch memory and disk checks, billing behavior and IP changes to the existing deployment and rollback instructions. ADR-0003 still applies.
- Captured the working local build in two Chrome sessions with separate synthetic Telugu and English microphone inputs. The recorder used browser MediaRecorder, real Sarvam processing in both directions and real OpenAI report generation. Played the two originals and two generated translations, switched report languages and followed an evidence link. The capture uses local private persistence. The four playback streams are synchronized into the video with labeled subtitles. Private artifact: .sahva/capture-xiMPd5/Sahva-demo.mp4.

### Test evidence
| Check | Result | Evidence |
| --- | --- | --- |
| [GitHub Actions run 44877467634](https://github.com/Abhijit-sai/sahva/actions/runs/44877467634) | PASS | Both check and publish jobs succeeded. Includes Linux install, lint, types, unit and offline browser tests, production build, container FFmpeg, HTTP liveness and release upload. |
| Backup capture and playback | PASS | Two UI microphone submissions, four media playbacks, two report languages, citation navigation. ffprobe reported 1440×960 H.264 video, AAC audio and timed captions, about 84 seconds. Full ffmpeg decode exited 0. |
| EC2, hosted DB migrations and two physical devices | PENDING | Mumbai inventory showed zero instances. EC2 launch prepared pending authorization. Private Storage buckets already verified through the configured API. Hosted PostgreSQL still needs a reachable endpoint. |

### Next phase
After authorization, install the release on the identified host, verify the project database from EC2, enable HTTPS and inspect memory with a live room and a deployment overlap. Complete two-device microphone QA. Use ops/AWS_DEPLOYMENT.md for patches. Preserve the clips, environment and private capture locally.

---
## [2026-11-21 12:34 IST] — Phase 5 — Workshop deployment attempt — BLOCKED

**Reporter:** Codex. **Repository/branch/HEAD:** sahva_project_pack / main / 4521fa3. **Upstream:** origin/main. **Ticket:** SB-07. The working tree was clean after the previous documentation push. This entry changes PROJECT_SUMMARY.md only. Exact event cutoff unknown.

### Implementation and test evidence
- The user approved the reviewed Mumbai launch and setup. On the EC2 launch form, selecting Create key pair returned an explicit identity-policy deny for ec2:CreateKeyPair on the workshop participant role. The policy is ws-default-policy. This API attempt failed before a key or EC2 instance was created. No application settings were transferred. This does not establish whether RunInstances is allowed.
- The host and application artifact architectures match. The first live EC2 readiness and physical-device calls are still pending. The earlier GitHub image, local two-browser integration and private fallback recording remain available.
- Local configuration metadata check confirmed the PostgreSQL direct host belongs to the configured Sahva project. The decoded password has literal surrounding square brackets. It was not printed or modified. The brackets could belong to the password. Database authentication is unverified because the workstation cannot resolve the direct endpoint.
- No migrations were applied to the remote PostgreSQL database in this attempt. No new architectural decision. No Supabase browser session was used.

### Next operator actions
Obtain the permitted workshop region, assigned instance or approved connection method from Event Details or the organizer. Obtain the project's IPv4 Session pooler DATABASE_URL and verify the password privately, then run the existing setup script and confirm committed tables. Resume with ops/AWS_DEPLOYMENT.md. The public site and two-device acceptance remain outstanding. Preserve all original data and local secrets.

---
## [2026-11-21 12:47 IST] — Phase 5 — Hosted database and production audio smoke — PARTIAL

**Reporter:** Codex. **Repository/branch/HEAD at start:** sahva_project_pack / main / 1c978fc. **Upstream:** origin/main. **Tickets:** SB-07, SB-08. Clean initial working tree. Exact cutoff unknown.

### Objective and implementation evidence
Verified the supplied Tokyo session pooler, scoped to the configured Sahva project. Strict TLS initially rejected its CA chain. Added the public Supabase production root to supabase/prod-ca-2021.crt and loaded it with hostname verification in scripts/setup-supabase.ts and lib/server/db.ts. Updated the private local connection string only after a successful authenticated query. No passwords, identities or audio were committed. Updated ops/AWS_DEPLOYMENT.md for certificate verification and region changes.

### Verification
- Live setup committed all four SQL migrations. A separate connection read back versions 001–004. Verified both existing private buckets and seven tables including the migration ledger.
- Local lint and typecheck passed, all 10 unit tests passed, production build passed. Production Next.js on loopback returned ready=true against hosted PostgreSQL.
- Two isolated Chrome sessions recorded synthetic inputs via MediaRecorder using the production build backed by Tokyo Supabase. Two original and two translated audio streams played. Both localized reports and evidence navigation completed, producing a private backup under .sahva/capture-EVNaTB. No user-provided voice recordings were used for the hosted storage check.
- Seven warm SELECT 1 samples from this workstation to Tokyo had a median of 123 ms. This does not measure EC2 latency. Prior consented clip receipts show Telugu → English stages of 470/852/2043 ms and English → Telugu 284/754/2511 ms for STT/translation/TTS. Those requests originated on this workstation.

### Decisions, blockers and next steps
The workshop's existing Oregon CodeEditor is separate from this deployment. User chose a dedicated Oregon EC2 host and an Oregon Supabase project for colocation. The Tokyo project is verified and available during cutover. A private ignored Oregon settings template is ready. No EC2 instance or Oregon database has been provisioned in this entry. Continue with Oregon host provisioning, project-specific runtime configuration, CI release verification and physical-device HTTPS acceptance. No change to the speech models or architecture.

---
## [2026-11-21 12:49 IST] — Phase 5 — Local demo first: remaining work and deployment handoff — PARTIAL

**Reporter:** Codex. **Repository:** sahva_project_pack. **Branch:** main. **Implementation HEAD:** e566dc4bc28013973a9338f31886cf39d2ca016b. **Upstream:** origin/main. **Working tree at handoff inspection:** clean; this handoff appends PROJECT_SUMMARY.md only. **Tickets:** SB-00, SB-03–SB-08. **Cutoff:** unknown.

### What the team can use now

- Start the demo on this workstation at http://127.0.0.1:3018 (local PostgreSQL-compatible persistence and local audio files; real Sarvam/OpenAI). The production build at http://127.0.0.1:3027 uses the verified Tokyo Supabase database and private buckets. Both homepages returned HTTP 200 and both /api/ready responses reported true at handoff. For a later restart, see ops/LOCAL_DEVELOPMENT.md. Localhost invitation links work in another browser profile on this computer.
- A live two-profile run processed four consented recordings. The separate production smoke used two synthetic microphone inputs and verified hosted storage, translated playback, and a bilingual meeting record. The private hosted-storage demo video is .sahva/capture-EVNaTB/Sahva-demo.mp4 (124.842 s). The shorter local demo is .sahva/capture-xiMPd5/Sahva-demo.mp4 (84 s). Both are ignored by Git.
- The existing two-person room uses MediaRecorder, HTTP uploads and polling in line with ADR-0001. LiveKit is deferred for a possible full-duplex open-mic requirement. The current demo needs no LiveKit setup. Sarvam handles each speaking turn (Saaras v4, Mayura v1 and Bulbul v4 Flash). OpenAI produces the post-call record.

### Resume here — product work before cloud setup

1. **SB-00, SB-03/04 — human rehearsal.** Open the local app in two separate profiles, use two real speakers and fresh microphone input, exchange two turns per speaker, and time Submit to playable translated audio. Check Telugu and English with a fluent reviewer, including a name, quantity and conditional promise. Record observed errors and separate the three Sarvam timings from total perceived delay. Existing automated QA and provider results do not establish native-speaker accuracy or physical-device behavior.
2. **SB-05/06/08 — meeting outcomes.** In the rehearsal, propose one action and explicitly accept a different one. End the room, compare both report languages, owners, missing deadlines and evidence. Confirm a speaker correction keeps the original recording. Record discrepancies and fix the smallest reproducible product issue first.
3. **SB-07 — physical-device and failure QA.** Use a browser-trusted HTTPS origin reachable from both devices for desktop + phone. Rehearse mic denial/recovery and playback gestures. A phone's localhost points to itself. Keep the local backup video available during the buildathon.

### Deferred infrastructure checklist — resume after the local rehearsal

- **Region choice.** User selected a separate Oregon EC2 host and permits a new Oregon Supabase project. The existing Tokyo project and its data are working. Use the Oregon/Oregon combination as the workshop target; it avoids cross-region database and storage calls. Sarvam describes India-based inference infrastructure but per-model endpoints have not been benchmarked from EC2. For India-based speakers, a future Mumbai/Mumbai deployment merits comparison if an authorized account permits it. Measure the same synthetic inputs from the target host before claiming a fastest combination. Keep OpenAI report timing separate from live speech.
- **EC2.** A launch form was prepared in us-west-2 for one t3.small x86-64 Amazon Linux 2023 server, 20 GiB encrypted gp3, a public IPv4 address, HTTP/HTTPS and SSH from the operator's IP. No Oregon key or instance was created and the launch was left unsubmitted. Do not deploy onto the workshop's running ARM CodeEditor. Mumbai previously denied key-pair creation. Verify the final Oregon settings, costs and operator approval before provisioning. Capture the instance identity and verify SSH host keys, trusted HTTPS and runtime permissions.
- **Supabase.** In the correct operator account, create the Oregon project when deployment resumes. For the private workstation handoff, .env.oregon.local has fields for NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_POOLER_HOST and SUPABASE_DB_PASSWORD. Keep credentials out of chat, Git and browser assets. Verify the supplied project identity, TLS, four migration versions, both private buckets and a fresh two-turn test before directing a demo to Oregon. Existing Tokyo rooms and media require a separate scoped copy if continuity is requested. Leave the Tokyo project available. Do not use the signed-in Chrome profile for Supabase.
- **Release and deployment.** GitHub Actions run 44879515775 for e566dc4 was in progress at last inspection. Check its final result and matching release before deployment. Follow ops/AWS_DEPLOYMENT.md for release installation, health check, rollback and the systemd timer. Record the running image SHA, public HTTPS URL, timed two-device smoke, and remaining demo limits here.
- **Preserve** both local environments, audio, existing history and workshop resources. No deployment secrets, user recordings, invitation links or AWS federation credentials are stored in version control.

---
## [2026-11-21 13:17 IST] — LIVE-01 — Local real-time phrase interpretation — VERIFIED locally

**Reporter:** Codex. **Checkout:** sahva_project_pack / main. **Starting HEAD:** 0c2f4bd. **Upstream:** origin/main. Clean initial tree. **Tickets:** LIVE-01, SB-03/04/05/06/07. Exact cutoff unknown.

### User-visible result and implementation
The user expanded the initial demo to real-time transcription and translation. Two participants can explicitly enable incoming voice, tap Speak live and see real source captions and provisional translations as the speaker talks. A natural pause submits the phrase and the other participant automatically hears the final translation. The original PCM recording remains available as WAV, and the final source transcript is bound to the attributed turn. Meeting intelligence uses the durable record. The manual recording flow remains available. The live panel shows the speaker and recipient languages. The timeline omits duplicate translated-text controls when the listener speaks the same language.

Added public/live-pcm.js, components/live-{conversation,microphone}, lib/server/live.ts and scripts/live-room-smoke.mjs. Updated the room API, turn processing, end-room guard, workspace/entry/turn UI, CSS, Dockerfile, npm metadata and the existing browser reload test. Added ADR-0004 and docs/14_LIVE_DEMO_PHASES.md; updated PRD, acceptance, architecture, API, WBS, local runbook and README. No new DB migration. Keys and QA audio remain outside Git.

### Test evidence
| Check | Actual result |
| --- | --- |
| Direct paid Sarvam realtime WebSocket, synthetic speech | v4 emitted a partial about 0.98 s (English) and 0.91 s (Telugu) after connection start, then final text in both sessions. |
| Final live Chrome test, two independent browser processes, synthetic microphones, real Sarvam/OpenAI, local persistence | Passed both directions, draft translations, pause submission, incoming auto-play, original WAVs, matching report languages, cross-speaker finish denial, active-mic end denial and consent withdrawal. |
| Latest Telugu → English application timing | Speak click to first nonempty peer caption 3.44 s; click to peer draft 4.26 s; finish request to browser playback start 3.32 s. Captured original 10.6 s. |
| Latest English → Telugu application timing | Speak click to first nonempty peer caption 2.37 s; click to peer draft 3.71 s; finish request to browser playback start 4.67 s. Captured original 8.2 s. |
| Regression checks | Lint, TypeScript, 10 unit tests and production build passed. All 3 offline Chrome regressions passed in 17.9 s after synchronizing the guest reload with its completed join. An earlier live run failed its second auto-play assertion during development; two subsequent two-direction runs passed. |
| Demo evidence | Local room on port 3018. Ignored screenshot .sahva/live-interpreter.png captures a live draft from synthetic test speech. Existing fallback videos show the recorded-turn workflow. |

### Decisions, deployment and remaining work
Single-process Node streaming relay, 16 kHz PCM, actual Sarvam interim events and rate-limited draft translations. LiveKit is deferred until a full-duplex transport requirement is proven. Progress: phases 1–3 exercised; phase 4 live phrase path verified locally. Phase 5 is continuous hands-free re-arming, interruption handling, reconnect and echo control. Phase 6 is two physical devices, fluent speaker review, measurements from the chosen host, a fresh live-mode backup recording and HTTPS deployment. The local synthetic tests do not measure time to a human ear, mobile behavior, conversational overlap or hosted latency. No AWS infrastructure or hosted Supabase settings were modified for LIVE-01. Inspect docs/14_LIVE_DEMO_PHASES.md and ops/LOCAL_DEVELOPMENT.md first to resume.

---
## [2026-11-21 13:22 IST] — LIVE-01 / SB-07 — Production-build check, release and backup — VERIFIED

**Reporter:** Codex. **Checkout/branch/HEAD:** sahva_project_pack / main / b162c09bf444dbb6af5ad42f8db2654e7969a3c0. **Upstream:** origin/main. Clean before this append. This update changes PROJECT_SUMMARY.md only. Exact event cutoff unknown.

- [GitHub Actions run 44881944095](https://github.com/Abhijit-sai/sahva/actions/runs/44881944095) passed both Linux check and publish jobs. [Commit-matched release](https://github.com/Abhijit-sai/sahva/releases/tag/build-b162c09bf444dbb6af5ad42f8db2654e7969a3c0) contains the 435,718,839-byte amd64 image archive and its checksum.
- Compiled Next.js production build, running temporarily on localhost with real Tokyo Supabase, Sarvam and OpenAI: the two-direction browser smoke passed, including captions, translated drafts, playback, originals, authorization/withdrawal and localized reports. Telugu → English click-to-caption / click-to-draft / finish-request-to-playback measured 3.94 / 3.94 / 12.83 seconds; English → Telugu measured 3.99 / 5.34 / 13.55 seconds. One run per direction from this workstation. The extra hosted-path delay merits profiling at the eventual colocated deployment before any latency claim. The temporary server exited after the test.
- Recorded a new live-mode fallback with two synthetic microphone inputs, actual translated audio, private original replay and both report presentations. The ignored file .sahva/live-demo-PA9rpT/Sahva-live.mp4 contains 59.84 seconds of H.264 1320×900 video, synchronized AAC audio from both sides and timed subtitles. Full FFmpeg decode passed. This supersedes the previous note about an outstanding local live-mode backup. Native-speaker review and physical-device rehearsal remain pending.
- Next product phase is LIVE-02 hands-free turn-taking and interruptions. Continue to use the running local source build on port 3018 for live demonstrations. AWS rollout, fresh device latency and real speakerphone QA remain open. No cloud deployment, migration, personal recording upload or architectural deviation in this verification pass.

---
## [2026-11-21 13:44 IST] — LIVE-02 / SB-07 — Hands-free conversation and Telugu voice — VERIFIED locally

**Reporter:** Codex. **Actual checkout, branch and implementation commit:** `D:\Develop\Builders 2026\sahva_project_pack`, `main`, `0c017badc4b4740258d14f9e2d1014f62656092d`. **Upstream:** origin/main. Clean checkout at fe68523 before implementation and clean after pushing the 17 implementation and specification files. This ledger update follows the code commit. Event cutoff unknown.

### Objective and user-visible result
Two consenting participants can activate the interpreter once, alternate Telugu and English phrases, read live captions and translated drafts, hear incoming voice, and finish with one evidence-linked meeting record in both languages. Someone wearing headphones can reply during playback. On speakers, default capture suppression protects the conversation from repeated translated phrases. Muting releases the device. Connection loss requires explicit microphone activation on return.

### Implementation evidence
- Browser audio and controls: components/pcm-input.ts and hands-free.ts (new), live-microphone.ts, live-conversation.tsx, recorder.tsx, workspace.tsx and client.ts. Local energy detection buffers up to 600 ms before speech and uses the existing single-speaker room lease. Provider traffic starts on detected speech. Archived audio playback suppresses new automatic turns.
- Provider: lib/providers/sarvam.ts and tests/speech.test.ts. Newly synthesized Telugu uses the existing Bulbul v4 Flash Telugu voice with pace 1.2 and pitch −0.1. The lower pitch value was an engineering choice. Private synthetic preview .sahva/telugu-voice-1.2x.wav decoded as 22,050 Hz PCM, 4.402 s. Native listener preference has yet to be tested. [Sarvam synthesis contract](https://docs.sarvam.ai/api-reference/text-to-speech/convert)
- QA and operating instructions: scripts/hands-free-smoke.mjs, README.md, ops/LOCAL_DEVELOPMENT.md, docs/01_PRD.md, docs/02_SCOPE_ACCEPTANCE.md, docs/08_WBS_AND_PHASE_PLAN.md, docs/14_LIVE_DEMO_PHASES.md and docs/adr/0004_live_interpreter.md. No new tables, migration, hosting change, credentials or personal data were required for this slice.

### Test evidence
| Check | Actual result |
| --- | --- |
| TypeScript, ESLint, Vitest, Next production build | Passed. 10 unit tests, 3 offline browser regressions passed in 17.2 s. |
| Two isolated Chrome sessions, generated Telugu and English microphone inputs, real Sarvam and OpenAI, local persistence | Four attributed, alternating turns with actual interim text, draft translation, original WAV, generated audio and the report in both languages. One activation per person. |
| Interruption and privacy | Passed simulated speaker bleed, hands-free interruption of Telugu playback, explicit playback stop, archive replay suppression, no room mic request during silence, microphone track release on mute and offline, explicit re-arming and both tracks stopping on consent withdrawal. |
| Hands-free timing in latest four-phrase regression | Synthetic input start to first observed peer caption, in order: 1.86 / 1.36 / 1.59 / 1.84 s. Phrase finish request to UI-observed playback: 2.84 / 4.38 / 3.07 / 4.69 s. Each pair alternates Telugu→English, English→Telugu. These are workstation measurements with a local database. |
| Existing manual live phrase regression with real providers | Both directions, source/draft captions, original persistence, automatic playback, room guards and localized reports passed. Finish request to playback was 3.86 / 3.98 s. |

### Decisions, blockers and next phase
- ADR-0004 continues to use one streaming relay process and the existing phrase archive. The headphone option interrupts already synthesized output. Simultaneous people still compete for a single live microphone lease. No LiveKit dependency was introduced.
- Local demo at http://127.0.0.1:3018 returned ready. AWS deployment and Oregon-vs-Tokyo end-to-end regional profiling are deferred. Existing deployment procedures are in ops/AWS_DEPLOYMENT.md.
- Next gate LIVE-03: rehearse with two people on a desktop and phone over trusted HTTPS. Measure quiet and noisy environments, first syllables and pauses, speakerphone echo, simultaneous starts, real mid-phrase network loss and the time to audible playback. Production-host timings need new measurements.
- Next voice ticket VOICE-01: offer optional named voice previews and speaker-selected delivery at join. Evaluate conveying emphasis, intonation and emotion with bilingual listeners. Carry any gender or voice preference from explicit speaker choice. Keep expressive cues separate from meeting facts. See docs/14_LIVE_DEMO_PHASES.md.
- Preserve ignored configuration, original recordings, previous timeline history and workshop resources. Generate future QA evidence in fresh private rooms.

### Release and backup evidence
- A separate concurrent lease test sent a start request from each authenticated session at the same time. One returned 200 and the other returned 409 MIC_BUSY. The second participant acquired the lease after release and zero empty turns were archived.
- Both Linux check and publish jobs completed successfully in [GitHub Actions run 44883663787](https://github.com/Abhijit-sai/sahva/actions/runs/44883663787). The [commit-matched release](https://github.com/Abhijit-sai/sahva/releases/tag/build-0c017badc4b4740258d14f9e2d1014f62656092d) contains a 435,848,318-byte amd64 Docker archive and a checksum.
- Private judge backup: .sahva/handsfree-showcase-Davs8T/Sahva-handsfree.mp4. Four distinct fictional microphone clips, actual translations, a spoken interruption and both real localized reports. The soundtrack uses the synthetic source waveforms and the exact returned translated WAVs at browser-observed start and end times. FFmpeg decoded all video and audio. FFprobe reported 87.04 s of 1320×900 H.264, AAC and timed subtitles. An earlier trial combining continuous browser audio tracks lost synchronization and was superseded by this capture. Keep the final recording local.

---
## [2026-11-21 14:26 IST] — LIVE-03 / SB-07 — Physical-device rehearsal setup — IN PROGRESS

**Reporter:** Codex. **Checkout:** sahva_project_pack / main / 3af8606613b14e6a8b65357e46d6925cd8295256. **Upstream:** origin/main. Tree clean before this append. Exact event cutoff unknown.

- Prepared an operator-approved, password-protected temporary Cloudflare HTTPS route to the laptop. The compiled Next.js UI uses a separate loopback listener and requests the original local room API on port 3018. The real provider and local storage settings are the same as the laptop demo. No AWS changes, Supabase migration or hosted database writes were needed.
- The private local launcher shows the short-lived gateway sign-in and generates a QR code on the laptop from the full room invitation, including its fragment. Temporary helpers, address, code, logs and QR page are under ignored .sahva/phone-test-* and excluded from Git. The helper schedules closure of the tunnel and the two temporary loopback servers at 16:19 IST. The existing local app continues separately.
- Public-origin Chrome check passed: anonymous request received 401, authenticated host created a disposable QA room, the second independent mobile-size browser joined using its invitation, and both sessions showed Start hands-free in a secure context with microphone APIs. The PCM worklet loaded. The host ended the QA room. No microphone capture or external AI calls were used to validate this setup. Local QR rendering passed with a synthetic invite. Initial test runs against the hot-reloading UI and a network-idle wait timed out; the successful run used the compiled UI and waited for form hydration.
- Physical rehearsal remains pending participant input: open the local launcher, create an English room, scan its invitation on the phone, join with Telugu, allow both microphones, exchange phrases and review meeting outcomes. Log actual phone model/browser, headset or speakerphone, latency and echo after the participants report them. No human room or recording consent was created on their behalf.

---
## [2026-11-21 14:32 IST] — LIVE-03 / SB-07 — First hands-free rehearsal — PARTIAL

**Reporter:** Codex, from the user's firsthand feedback. **Checkout:** `D:\Develop\Builders 2026\sahva_project_pack` on `main` at `430d32774917ace56517cbfd60c00ba4e5500058`, tracking `origin/main`. Working tree clean before this documentation update. Event cutoff unknown.

- **Rehearsal result.** Following the phone-and-laptop setup, the user tried hands-free and encountered issues. The affected device, browser, audio setup, symptoms and steps to reproduce are unknown. The user did not report whether both translation directions and the end-room summary completed. Physical-device acceptance remains open.
- **Decision.** The user deferred troubleshooting. When LIVE-03 resumes, record one concrete example with the speaking device, language direction, expected result and observed result. Follow that phrase from microphone pickup through captions to remote playback, then repeat in the opposite direction. Earlier automated checks and their timings remain in the LIVE-02 entry.
- **Handoff.** VOICE-01 remains planned: optional speaker-selected voice and delivery preferences, followed by bilingual listening tests for tone and emphasis. Public AWS deployment and hosted latency measurements are still pending. This session updated only `PROJECT_SUMMARY.md`. No application tests or provider calls were run for this documentation change.

---
## [2026-11-21 14:39 IST] — Release planning and repository reconstruction — VERIFIED

**Reporter** Codex · **Checkout** sahva_project_pack / main / 8250dda702077bb07e4723589a0ec2b90ddae2c9 · **Upstream** origin/main · **Ticket** LIVE-03 · **Deadline** unknown.

The initial index, worktree and untracked status were clean. Inspected source, migrations 001–004, tests, release workflow, environment names, deployment runbook, Git history and the private backup file listing. The four-turn provider success and timings are prior LIVE-02 evidence. The latest firsthand device feedback records an issue without details. Public AWS acceptance is outstanding. The temporary phone gateway was a rehearsal route.

Updated PRD, acceptance, architecture, provider evaluation, data/API contracts, WBS, QA and risks. Reviewed current vendor documentation and separated per-direction language support and pricing. Retain ADR-0004 and the manual fallback. Future cross-speaker concurrency requires independent generation, queue and stable segment boundaries before any default changes. No code, migrations, provider calls or deployment in this planning step. Start LIVE-03 with timing diagnostics, then rehearse with two real devices.

---
## [2026-11-21 14:44 IST] — LIVE-03 — Timing instrumentation and clarified device feedback — PARTIAL

**Checkout** sahva_project_pack / main / 8250dda, tracking origin/main. Changes are unstaged. **Reporter** Codex. **Deadline** unknown.

Added numeric capture, relay, translation, generation and listener playback observations to the existing room, with clock-offset estimates, missing-sample handling and direction-specific distributions. Existing turn timings JSON accommodates older rows without migration. Typecheck, ESLint and 12 unit tests passed. A fresh four-phrase synthetic Chrome run using real providers on port 3018 passed both report views, attribution, interruption, echo simulation and media release. Samples per direction were two. Telugu → English last voiced frame to scheduled playback median/p95/worst was 4256/4535/4535 ms. English → Telugu was 4642/4839/4839 ms. First displayed caption medians were 1763 and 1226 ms respectively. Neither English → Telugu playback ran to completion because the test interrupted both.

The human speaker confirmed the laptop spoke and translation was acceptable. The problem was how the listener associated audio, captions and originals with a particular message. The exact language direction and acoustic results are still unknown. Prioritize this call-interface correction in LIVE-03. The AWS console independently shows a running dedicated sahva-demo x86-64 Amazon Linux 2023 host in Oregon. No deployment has occurred and the Oregon database template has no values. Verify the SSH identity, HTTPS address and target database before release.

---
## [2026-11-21 14:57 IST] — LIVE-03 and SB-07-AWS — Call messages verified locally, host prepared — PARTIAL

**Reporter** Codex · **Checkout** sahva_project_pack / main / 8250dda, origin/main verified on the remote. **Deadline** unknown. This entry accompanies the release candidate.

The participant list and call controls stay beside the chat on desktop. A phone-sized layout shows participants and messages together. Join audio call activates hands-free capture and translated playback. A remote message defaults to its translated recording and caption. Original reveals both source recording and raw transcript, including a separate speaker correction when present. Own messages prioritize their source. Playback retry preserves pending turns. Playing archived audio interrupts automatic output. Single-phrase input and recording remain under Audio options. Updated workspace, live controls, turn cards, CSS, README and browser scripts.

Fresh real-provider four-turn test on localhost verified the exact translated caption, playback source, Original disclosure and text for every message. Both reports passed. On two samples each, last voiced frame to scheduled playback median/p95/worst was 3950/3951/3951 ms Telugu → English and 4854/5052/5052 ms English → Telugu. Visible translated-caption medians were 2069 and 1834 ms. Approximate combined clock uncertainty is shown per message. An earlier run timed out at third-turn playback while the development build was changing. The separate live phrase fallback passed in both directions. Three offline browser regressions passed in 21 s. Typecheck, lint, 12 unit tests and isolated production build passed. Sandboxed loopback and Windows junction creation required rerunning browser/build checks with permissions. Human follow-up remains pending.

Verified dedicated Oregon instance against the EC2 boot-log SSH fingerprint. Docker and Git installed. The operator approved the existing Tokyo settings for this host. Only the six required settings and public origin were installed in a root-owned 0600 runtime file. Git and Docker ignore PEM files. The published 0c017ba baseline passed archive checksum, private bucket and migration checks, and returned ready on loopback. No new instance or database was created. Next: publish and verify the new release, finish HTTPS for sahva.madsoul.in, then run the remote synthetic and physical calls.

---
## [2026-11-21 15:08 IST] — SB-07-AWS / LIVE-03 — Regional startup failure reproduced and patched — PARTIAL

**Reporter** Codex. **Checkout** main at 940b42c, tracking origin/main. **Deadline** unknown. Linux check and publish jobs passed in workflow 44889794331. On Oregon EC2 the release timer installed that exact image, verified private Tokyo storage and reported ready. The HTTPS proxy is installed. Public DNS did not yet resolve at the authoritative nameserver.

A fresh synthetic call against the deployed image over a private SSH forward produced zero messages. The speaker saw “Speech connection took too long.” The original two-second opening buffer expired during the cross-region lease and provider handshake. Reused the state from the authorized lease transaction, bounded the onset buffer at six seconds, and batched up to two waiting PCM frames per ordered request. The same one-speaker and provider limits apply.

The new unit regression verifies all five frames arrive in order and a manual finish waits for the upload. 13 unit tests passed. With 2.6 seconds artificially added to start and 220 ms per frame request, four alternating synthetic turns passed with real providers, interruption, mute, reconnect, same-message original and translated media and both localized reports. A 390-pixel listener viewport retained conversation access. These are local adverse-network checks. Next verify the patched image on EC2 before physical acceptance. No migration in this patch.

---
## [2026-11-21] — Public MVP verified and Phase 4 meeting milestone defined

Codex verified the public release on main at 41c5cf7, matching origin/main. The Oregon host serves sahva.madsoul.in over trusted HTTPS against the original Tokyo database. The public browser fixture completed four alternating phrases, private original replay, interruption, mute, reconnect, consent shutdown and both localized reports. Two samples per direction gave median visible captions of 4.91 s Telugu to English and 5.40 s English to Telugu from onset. Median last voiced frame to scheduled listener playback was 13.13 s and 14.49 s respectively. The operator confirmed the site was visible. Physical acoustics and human translation quality remain unverified.

The workspace retains unpublished voice previews, per-speaker voice choices, and an isolated provider comparison using identical generated recordings. Source and translated text matched between the two processing paths on one clip per direction. The LiveKit browser, server and Node RTC dependencies were installed locally for the next milestone and are not active in the MVP. No group-room schema or LiveKit transport has been deployed. No new credentials or infrastructure were provisioned for that work.

Next ticket is STREAM-01 from Phase 4 of the continuation brief. Deliver a feature-flagged vertical path from individual microphone tracks to listener-specific chat and audio. Verify a third participant, overlap, consent revocation, original replay and canonical report provenance. See the current milestone in docs/08_WBS_AND_PHASE_PLAN.md. No deadline supplied.

---
## [2026-11-21] — Phase 4 · STREAM-01 · Three-person meeting verified with LiveKit Cloud

On main based on 41c5cf7, added an opt-in LiveKit group room with six authenticated seats, group-specific disclosure and consent, independent microphone streams, bilingual listener-specific captions and automatic audio, same-message source replay and shared reports. Migration 005 preserves the phrase transport for existing rows. Each browser publishes only its microphone, grants the interpreter subscription permission, and receives its own scoped playback through Sahva. On withdrawal, the server stops the bridge and increments the media epoch. This release plays finalized segments. Physical acoustics and early synthesized playback before a segment ends remain open.

The supplied portfolio project authenticated successfully. Its portfolio agent uses explicit named dispatch. Sahva has its own room namespace and interpreter identity. Credentials stayed in the supplied settings and the local test runtime. None were added to the repository.

Two successful Cloud runs used three Chrome profiles, the Linux Sahva app running on localhost, a local database, real providers and generated English/Telugu microphone waveforms. The same English utterance produced Telugu voice/text for one listener and English original voice/text for the other. Both source replays decoded. Overlapping English and Telugu inputs appeared as two live speakers and durable turns. Consent stopped audio on all three clients, rejoin succeeded, and the report linked to evidence. On the final run the first English utterance produced a visible Telugu draft at 2.06 s and both browser players had started by 12.71 s from onset. These are single-observation timings with the app local and media routed through Cloud.

TypeScript, ESLint and 14 unit tests passed. The four offline Playwright tests passed with a Linux test server and Windows Chrome, including concurrent admission up to six, refusal of the seventh and epoch rotation. The production Linux image loaded the native RTC SDK. The direct Windows native module was blocked by Application Control. One Windows test run exhausted host memory and an intermediate Cloud retest timed out while the dev build was changing. Both paths were rechecked with isolated execution. Linux npm ci also exposed two missing optional dependencies in the Windows lock; regenerating the lock under Linux fixed the build. Local entry point is http://localhost:3024 with Group meeting selected at creation. Next verify a physical phone/laptop meeting and compare time from the end of speech to first audible translation on the intended deployed route.

---
## [2026-11-21 16:03 IST] — STREAM-01 · Group meetings released and tested on public HTTPS

The operator approved the production migration and shared LiveKit settings for the existing Oregon host. GitHub Actions [44894300610](https://github.com/Abhijit-sai/sahva/actions/runs/44894300610) passed and published c7011ab2b809f10d44caed15eb19ca787d06ef14. The pinned host installed the checksum-verified image. Both media buckets passed the private-storage check. The applied checksum for migration 005 matched the repository. The public homepage offered Group meeting and the HTTPS readiness endpoint returned ready.

Ran scripts/meeting-smoke.mjs with three independent Chrome profiles against https://sahva.madsoul.in. The test supplied synthetic microphone speech to the real services. Listeners received the same attributed English message in Telugu translation and in the original English according to preference. Original transcript and audio replay matched. Two simultaneous English and Telugu speakers produced distinct turns and captions. Consent withdrawal stopped the room audio on all clients. Consent restoration and audio rejoin passed, and ending the room produced a report with evidence. The test exited successfully.

For the first utterance the Telugu draft was visible at 4.35 seconds and both browser players had started by 20.36 seconds from onset. This is one production observation. Physical phone and laptop acoustics, perceived latency and fluent-listener quality remain open.

---
## [2026-11-21 16:06 IST] — Phase 4 group meetings · Production handoff

**Project status.** The first group-meeting milestone in Phase 4 (P3 STREAM-01) is deployed and passed end-to-end acceptance with three automated browser participants. The wider goal is a natural, low-latency interpreted conversation. Live captions arrive during speech. Translated audio currently starts after a phrase is finalized. Physical-device acceptance and earlier translated playback are still open. [Phase plan](docs/08_WBS_AND_PHASE_PLAN.md)

**What people can use.** On the public site, choose **Group meeting** under **Room type**, share the invitation, select speaking and listening languages, and join meeting audio. A room admits up to six members. On desktop the roster is on the left and attributed dialogue is on the right. Each listener sees captions and hears audio in their selected language. **Original** opens the source recording and transcript for that same message. The two-person MVP is also available. [Public app](https://sahva.madsoul.in)

**Release and operating decisions.** Production runs application commit `c7011ab` on Oregon EC2 with the original Tokyo Supabase database. Migration 005 was applied and checksum-verified. LiveKit Cloud carries one microphone track per participant. Sahva’s interpreter uses Sarvam for recognition, translation and synthesized speech. OpenAI produces meeting reports from finalized turns. The shared LiveKit credentials are installed server-side in the root-only runtime. The local Linux preview uses `http://localhost:3024`, the `unless-stopped` restart policy and the `sahva-meeting-preview-data` volume for room data. [Architecture decision](docs/adr/0005_livekit_meetings.md) · [Deployment runbook](ops/AWS_DEPLOYMENT.md)

**Evidence.** The release passed type checking, lint, 14 unit tests and four offline browser tests. The public test used generated microphone speech and real services. Three browser profiles verified English and Telugu delivery, original replay, two overlapping speakers, consent withdrawal, audio rejoin and an evidence-linked report. The six-seat limit was tested separately through concurrent admission and seventh-seat refusal. On one public English utterance, the Telugu draft appeared 4.35 seconds after speech began and both browser players had started by 20.36 seconds from that same onset. The time from the end of speech to the first audible translation still needs measurement on the group-room release. [Public test driver](scripts/meeting-smoke.mjs) · [Release workflow](https://github.com/Abhijit-sai/sahva/actions/runs/44894300610)

### Next session

1. **Physical acceptance (LIVE-03).** Run fresh English and Telugu speech through the public meeting on a phone and laptop. Check microphone pickup, speakerphone echo, interruptions, caption attribution and original replay. Record caption onset and the delay from the speaker finishing to the listener hearing the translation in each direction. [Rehearsal guide](docs/09_QA_AND_DEMO.md)
2. **Conversation latency and voice quality (STREAM-01, VOICE-01).** Use those timings to find the longest delay. Evaluate earlier playback on stable translated segments against the same recordings. Voice selection and previews have shipped. A fluent reviewer still needs to assess intelligibility, names, numbers, pacing and question intonation. [Comparison script](scripts/compare-directions.ts) · [Voice cases](qa/VOICE_TEST_CASES.md)
3. **Meeting and site UI.** The owner plans to supply visual direction. The interaction brief calls for the participant roster on the left, WhatsApp-style speaker bubbles on the right, preferred-language audio and captions by default, and one-click originals. Use the public meeting for design review.
4. **Demo acceptance (DEMO-01).** Rehearse the public meeting and its report on the target network, then capture a backup of the group-room flow. The existing private synthetic backup covers the earlier two-person hands-free version.

Codex reconciled this handoff against `main` at `c9ee933`, the release record, and the phase plan. The checkout matched `origin/main` and was clean before this documentation update. The production application version is `c7011ab`.

---
## [2026-11-21] — S2ST-01 · Direct interpretation experiment opened

Codex inspected the clean sahva_project_pack checkout on main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f, tracking origin/main. No concurrent deployment edits were visible. A fresh public readiness GET returned true and pinned-host Docker inspection returned sahva:c7011ab2b809f10d44caed15eb19ca787d06ef14. The architecture now records the per-speaker PCM seam. Proposed ADR-0006 and the WBS define provider validation, independent directions, paired benchmarking and conditional regression gates. No new deployment is planned. Google documents the requested preview and both languages. Account entitlement, speech performance and listening quality require actual trials. Deadline unknown.

---
## [2026-11-21] — S2ST-01–03 · Authenticated bidirectional speech and browser playback verified

The operator provided GEMINI_API_KEY in ignored local settings. Developer API v1beta models.get returned HTTP 200 for models/gemini-3.5-live-translate-preview with bidiGenerateContent. Two independent setup acknowledgements, both transcript streams, voiced English/Telugu output and progressive Chrome playback were subsequently observed. The test-only selector is the CLI engine argument under scripts/s2st. Existing app processes never load the experiment.

An early Telugu/English fixture pair reached voiced playback but hit the drain timeout because Gemini continued emitting silence. Closing after a bounded quiet interval fixed the standalone trial. The first fake-microphone smoke captured zero frames because the worklet module did not load through the intercepted local URL. Loading Sahva's existing worklet source as a local Blob fixed it. Final file-backed Chrome microphone runs 3DHsBR and 9PCiau captured 25 seconds each, returned both directions and played translated speech while capture was still running. See the per-language journals for timing. The tests used synthetic speech with the real provider. No human microphone was activated.

---
## [2026-11-21] — S2ST-04–06 · Matched comparison finished, LiveKit integration gate failed

**Checkout and deployment.** Codex worked in the existing sahva_project_pack checkout on main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f. A read-only remote lookup returned the same SHA. Work is local and unstaged. Changed PROJECT_SUMMARY.md, docs/04_APPROACH_ARCHITECTURE.md, docs/05_TECH_STACK_AND_PROVIDERS.md and docs/08_WBS_AND_PHASE_PLAN.md. Added docs/adr/0006_gemini_live_translate.md, qa/S2ST_BENCHMARK.md and scripts/s2st/ for fixtures, PCM, the two engines, browser playback and matched comparison. No migration, commit, deployment or production configuration change. The public service passed readiness and was running c7011ab at preflight.

**Evidence.** Five synthetic scripts per direction were streamed concurrently through two Gemini sessions and through the released Sarvam room functions using local database/media and the same browser sink. The offline comparator verified the original PCM hashes for all ten pairs. All 22 translated WAVs in the paired set decoded using FFmpeg. Sarvam split each pause recording into two deliveries. Median speech onset to first voiced playback was 3.118 versus 9.078 s on Telugu input and 3.062 versus 9.320 s on English input (Gemini versus Sarvam). Median first caption favored Sarvam in both directions. The complete timing table, pricing assumptions, private evidence IDs, reproduction commands and quality observations are in [the benchmark report](qa/S2ST_BENCHMARK.md).

**Decision.** Gemini introduced a date, changed 15 to 50, reversed a backup dependency and turned a question into an assertion on this fixture set. Independent ASR of three original/generated pairs corroborated significant changes. Replay of the sources permits human adjudication. No paired Gemini journal supplied a final transcript flag or turn-complete signal. Leave group rooms, consent, selected voices, media and canonical reports on Sarvam. Do not advance the current preview to S2ST-05. A later trial should start with the numbers, negation and mixed-language counterexamples, equivalent held-out utterances, and blinded bilingual listening.

**Tests and limits.** Standalone Gemini/sarvam commands, ten-pair offline comparison, file-backed microphones, playback stop and a deliberate single-channel disconnect were exercised. Each playback queue discarded three buffers on stop. On disconnect the affected trial returned nonzero as expected and the other channel completed. Subsequent fresh sessions succeeded. Seamless resumption, long-session behavior, physical acoustics, voice preferences under Gemini, human naturalness and actual invoiced charges remain unverified. npm run typecheck and npm run lint passed. npm test passed 14 tests and npm run test:browser passed all four existing offline Chrome regressions in 18.5 seconds. The earlier public group-room E2E remains the release evidence for c7011ab.

---
## [2026-11-21] — S2ST-02 · Local listening demo ready for human rehearsal

On main at 3655e76 with the existing unstaged experiment, added scripts/s2st/demo.ts, demo.html and demo.js and a launch guide in qa/S2ST_BENCHMARK.md. The loopback page uses the existing dedicated Gemini adapter and Sahva PCM worklet, with selectable speaking direction, live transcripts, progressive playback, latency display, replay and immediate cancellation. A trial starts on user action. The local demo process does not persist utterances or create meeting records. The production Sarvam service was not changed.

Verified HTTP 200 and exercised both directions in Chrome using synthetic microphone streams and real Gemini responses. First voiced playback was scheduled 3.14 s from detected Telugu onset and 3.31 s from detected English onset on one clip each. Both tests received source and translated text, enabled replay, released the microphone when finished and cleared the previous trial on direction change. Type checking and lint passed. Human accuracy, perceived delay and acoustic quality remain for the operator to assess.

---
## [2026-11-21] — S2ST-04 · Human listening feedback confirms adoption hold

The operator reported wrong-language recognition on spoken Telugu and inadequate English → Telugu interpretation. The supplied mixed-language example omitted the final Telugu revenue question from the translated caption. The old local page labeled source text from the selector and discarded provider language metadata. Updated scripts/s2st/engines.ts and the local demo.ts, demo.js and demo.html to hint the chosen source, request target-language echo for this listening demo and show provider-reported languages and third-language mismatches. No production or LiveKit change. Recorded the trials in qa/S2ST_BENCHMARK.md.

Real Google setup accepted the hint and translation instruction. One Telugu fixture was reported as Telugu. Both mixed-language A/B runs preserved the trailing question and changed 15 to 50. The human omission was not reproduced. A Chrome UI regression with simulated Hindi and Vietnamese events verified labels, notice and reset. Typecheck and lint passed. The idle loopback demo was reloaded on port 19752. Human voice accuracy with the new settings remains unverified. The decision to retain Sarvam stands.

---
## [2026-11-21] — S2ST-04 · Reporting-period prompt tested in both comparison directions

On main at 3655e76, updated scripts/s2st/engines.ts and demo.ts, added quarter-ab.ts and recorded the blind review in qa/S2ST_BENCHMARK.md. The loopback demo at port 19752 reloaded after active connections cleared and returned HTTP 200. Only its English → Telugu sessions opt in to the new reporting-period instruction. No application release, public service restart or production configuration change.

The operator's original recording was unavailable. Four independently verified synthetic source files produced eight byte-matched pairs and sixteen Gemini responses. Before assignments were revealed, the two prompts each scored 7/8 for a clear quarter relation and 8/8 for correctly assigned monthly figures. Complete minimum-target negation appeared in 2/8 old-prompt and 4/8 new-prompt translated captions. On Telugu wording the new prompt won one pair, the old prompt won three and four tied. This is a text review with an independent output-ASR cross-check. The utterance ending is still unreliable under the trial's end-of-input timing. The new instruction is available in the local demo, and the public meeting continues to use Sarvam. npm run typecheck, npm run lint and 14 unit tests passed. Private paired evidence and reproduction commands are in the benchmark report.

## [2026-11-21] — S2ST-04 · English → Telugu end-of-speech handling

On main at 3655e76 (uncommitted experiment), ran 16 real Gemini sessions on the same four synthetic English quarter recordings, twice per recording for each ending policy. Immediate audioStreamEnd preserved the spoken minimum-target negation in 0/8. Four seconds of server-generated silence before audioStreamEnd preserved it in 8/8 according to independent output ASR and captions. Extending the post-end quiet cutoff from 4.5 to 8 seconds produced identical speech and captions. The median within-pair cost was 2.48 seconds to the end of voiced playback and 2.95 seconds to trial completion.

Added scripts/s2st/ending-ab.ts and ending-smoke.mjs, updated scripts/s2st/demo.ts, demo.js and demo.html, and recorded methods, reproduction commands and evidence in qa/S2ST_BENCHMARK.md. The idle local demo on port 19752 was reloaded. Real Chrome synthetic-microphone smoke passed with the negative ending, immediate microphone release and 4.22 seconds of end delay. Public Sarvam release c7011ab is the previously recorded production baseline. No deployment or production configuration change was made. Next test shorter silence and human utterance endings before considering any group-room integration.

## [2026-11-21] — S2ST-04 · Exact captured input restored

On main at 3655e76, removed generated input silence from both directions of the local Gemini demo and the default standalone runners. Updated scripts/s2st/demo.ts, demo.js, run.ts, quarter-ab.ts and ending-ab.ts. Added the local demo-pcm.js worklet and tests/demo-pcm.test.ts to forward partial final packets in order. The deployed Sarvam and LiveKit paths were untouched.

Sixteen fresh Gemini sessions compared immediate end to four seconds of waiting with zero extra samples using the same four saved synthetic recordings. All sixteen submitted PCM hashes matched their fixture hashes. Spoken minimum negation survived in 0/8 in either arm. One Telugu caption and its independently transcribed audio also moved a 10% increase from last month to this month. qa/S2ST_BENCHMARK.md records artifact paths, methods and reproduction options. The idle localhost demo was reloaded and Chrome verified microphone release and replay. Twenty unit tests passed. The next open question is provider end signaling for exact audio. Production remains on the previously recorded Sarvam baseline.

## [2026-11-21] — M0 · Multi-provider evaluation plan

Main and origin/main were at 3655e76, with previous Gemini documentation, experiments and design-pack work present and no staged changes or second worktree. Latest recorded public release c7011ab. Reviewed room consent, worker, listener playback, storage constraints and tests. Added ADR-0007, the architecture reference and M0–M7 WBS. Begin with exact-audio replay and the server-gated selector. Keys stay in the ignored local environment. Model registration alone does not establish account access. Planning entry; no new model result yet.

## [2026-11-21] — M1/M2/M3 · Existing local listening demo now compares engines

The operator selected the existing loopback listening demo as the immediate test surface. Added the directional registry, provider-specific WebSocket adapter, 16→24 kHz conversion and drain handling, reusable lab engine selection, exact-file probe, synthetic Hindi fixture, microphone and comparison smoke tests under scripts/s2st. Expanded the same demo.html, demo.js and demo.ts to support microphone, last capture, scripted fixtures, upload, matched comparisons, original/translated audio, browser metrics and separately entered human review. Existing Gemini behavior and Sarvam benchmark adapter are reused. Added tests/translation-lab.test.ts, the lab npm command and example environment names. Updated architecture, provider, API, WBS, risks, ADR-0007 and qa/S2ST_BENCHMARK.md. No meeting code, deployment configuration or database migration was changed.

Nine authenticated CLI trials covered Telugu → English (Sarvam, Gemini, OpenAI), English → Telugu (Sarvam, Gemini), and both Hindi/English directions (Gemini, OpenAI). OpenAI preserved the correction but changed the name on Telugu input. It preserved the Hindi output instruction on English input and changed the first instruction into a completed sale on Hindi input. Gemini had truncation and quantity errors. The measured comparison table and private artifact locations are in the QA report. An independent Chrome comparison on identical English audio scheduled first Hindi playback at 3.03 s for Gemini and 4.00 s for OpenAI, verified output players, matching hashes and review export. A Chrome file-backed microphone using OpenAI Hindi → English verified release, end handling and replay, with a 6.95 s end delay; the final caption again misrepresented the first instruction. No fluent human review score recorded.

Qwen 3.8 has a protocol-tested adapter, English/Hindi documented and Telugu excluded. No matching LiveTranslate model appeared in OpenRouter's 476-model public catalog; a region-bound Alibaba key/workspace is needed for an authenticated integration run. Azure and ElevenLabs are research only. Local baseline still covers English/Telugu only. LiveKit selection is deferred per user steering. The live public health check returned running and readiness true; those endpoints do not expose the build SHA. Latest recorded release c7011ab. Main HEAD remains 3655e76, work is uncommitted alongside prior experiment files. Production build, typecheck, lint, 23 unit tests, four existing browser regressions and both local lab smokes passed. Next: bilingual reviewers compare the same human recording and log critical errors; run a paid-access Qwen test when the regional account is available.

## [2026-11-21] — M6 · Nine operator-recorded listening trials reviewed

On main at 3655e76, matched all nine source PCM hashes and sample counts in the operator's review export to WAVs in docs/Recordings. The directory contains 22 WAV files and 18 distinct whole-file hashes. Paired the nine outputs by recorded content and download sequence. The export has no output digest. The private replayable report is .sahva/listening-review-9/review.html. Its generator verified all 18 distinct media links. Faster-whisper ran locally on every track. With explicit permission, seven Telugu-language WAVs were transcribed as complete files using saaras:v4 and te-IN. Machine readings and unconfirmed terms are labeled separately from the original provider evidence. No human naturalness scores were assigned.

The audio checks exposed a changed question and a lost event on Gemini Telugu to English, an introduced year count on OpenAI English to Hindi, and a polarity and percentage qualifier change already visible in the Sarvam English source caption and carried into Telugu speech. One Sarvam trial also returned a delivery error. Nine different microphone takes prevent a controlled ranking. The next M6 comparison should replay identical source PCM for each eligible engine and score speaker-confirmed critical clauses per direction. Two captured files contain 400128 samples, 128 over the lab file-upload ceiling; exact replay of those two via upload needs the lab to accept its own capture length. No production code, provider routing or deployment was changed. The previous recorded release remains c7011ab. The tree contains earlier uncommitted experiment work.

## [2026-11-21] — M6 handoff for the next chat

**Resume in the local listening lab.** The public LiveKit meeting uses Sarvam. The last recorded deployment is `c7011ab`. The local checkout and its upstream-tracking ref `origin/main` are at `3655e76`, with unstaged and untracked experiment work. This handoff is saved locally. Check Git status before editing. Launch the lab from the repository root with `npm run lab:translate` if port 19752 is free. ADR-0007 and `qa/S2ST_BENCHMARK.md` cover provider eligibility and prior matched tests. Qwen still needs authenticated LiveTranslate access for a spoken Hindi/English trial.

**Evidence to reopen.** Start with [the nine-trial listening report](.sahva/listening-review-9/review.html). It links the original and translated WAV for each trial and shows provider captions beside independent machine readings. The audio is in `docs/Recordings/`. The original export is `C:/Users/abhij/Downloads/sahva-translation-review.json`. Both the media and the private report are local to this machine. The prior entry records the hash and file checks. The seven approved Sarvam file transcriptions are saved beside the report and can be reused without another provider call.

| Trial | Finding to carry forward |
| --- | --- |
| 1–2 · OpenAI, Telugu → English | The live source captions used Bengali and Devanagari scripts. The English invitation in trial 1 has weak support. A possible name in trial 2 still needs speaker confirmation. |
| 3–4 · Gemini, Telugu → English | A repeated question about what someone is building became a statement about getting married. In trial 4 the butterfly-effect question survived, but an India hackathon became “India’s heart.” |
| 5 · Sarvam, Telugu → English | The live caption, English audio and separate Telugu file transcription disagree on the time expression. Ask the speaker for the exact wording before scoring the number. |
| 6–7 · English → Hindi | Gemini retained the bad year and approximate decline in trial 6. OpenAI retained the 10% decrease in trial 7 but introduced 34 years. First voiced playback was 5.44 s and 5.40 s respectively on different takes. |
| 8–9 · English → Telugu | Gemini changed a question about sales-team motivation into one about absent sales. Sarvam changed “very bad” to “very good” and “about 10%” to “over 10%” in its source caption and translated speech. Trial 9 also reported a delivery error. |

**First unblocked task.** Make the lab accept its own 400,128-sample recordings on exact WAV replay, and verify the submitted source hash. Preserve every captured sample and add zero synthetic silence. Then use trials 3 and 9 as the first speaker-confirmed references. Replay each identical original across eligible engines for that direction, record whether the question, polarity and numeric qualifier survive, then compare playback delay and human-rated voice quality. Save source and output WAVs, their hashes, captions, provider configuration and failures together in future review exports. A controlled ranking on these human recordings, human naturalness scores and a LiveKit integration decision remain open.


---
## [2026-11-21 19:15 IST] — GPU-00 · Planning — VERIFIED

**Checkout and status.** Codex reviewed D:/Develop/Builders 2026/sahva_project_pack, main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f, equal to remote origin/main. One worktree, eight unstaged tracked changes and 100 untracked files at entry, nothing staged. Existing listening lab, design pack and competing ADR numbers were reconciled by adding proposed ADR-0008. Files show earlier session work. Concurrent editing by another operator is unknown. Deadline unspecified.

**Result and evidence.** Updated canonical PRD through engineering/runbook/handoff docs. Public readiness returned true. Last host-verified application SHA c7011ab. The earlier ten synthetic pairs and nine independent operator takes provide timing and failure examples. The operator confirms speaker-verified references are pending. Both MT model SHAs and Hub gate metadata verified. AWS regional quota and pricing evidence is in the runbook. No running GPU, expense, migration, release or commit from this phase. Next LAB-01 covers a bilingual recording sheet, exact replay and real Sarvam timing. New model quality untested.

---
## [2026-11-21 19:43 IST] — LAB-01 · Baseline and fixture intake — PARTIAL

**Checkout and scope.** Codex, D:/Develop/Builders 2026/sahva_project_pack, main 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f tracking origin/main. Unstaged prior lab and design work preserved. Deadline unspecified. Pinned SSH inspection verified running image c7011ab2b809f10d44caed15eb19ca787d06ef14. No commit, deployment or migration.

**Result.** Added qa/RECORDING_SHEET.md (30 prompts per direction), phone recording import, original and decoded hashes, recording-directory exclusions and a 26-second replay ceiling aligned to the loopback server. Browser exports identify the first source/final captions and generated WAV digest. Operator supplied EN/TE 01–05. The private .sahva/mt-fixtures-15rJEs manifest identifies ten original M4As and canonical WAVs, totaling 80.46925 seconds. Original files preserved. All reference texts await speaker review.

**Tests.** Three compare-directions.ts trials on the fictional correction pair used real Saaras v4 / Mayura v1 / Bulbul v4-flash in both directions. The QA report records stage timings and hashes. A separate Chrome run verified downloaded audio digests and source-end to scheduled playback (TE input 2658 ms, EN input 3752 ms). The first download probe failed because CSP blocked direct blob fetch. Browser downloads succeeded. Chrome upload decode and CLI decoding matched the earlier two 400128-sample microphone digests. Typecheck, lint, build, 23 unit tests and four offline room browser tests passed. No real GPU uptime or cost. Existing private QA report history was reconstructed from the original edit records after an accidental overwrite, including the original correction and all six appended sections.

**Next gate.** Confirm actual words and processor consent, run the human baseline and then blind-compare MT on identical verified texts. Keep human evidence under .sahva. ADR-0005 governs deployed rooms.

---
## [2026-11-21 20:03 IST] — GPU-02 / LAB-02 · Worker contract and private MT comparison — PARTIAL

**Checkout.** Codex, main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f, tracking origin/main. Local uncommitted work alongside earlier experiments. Public host image c7011ab2b809f10d44caed15eb19ca787d06ef14. No room routing, migrations or deployment.

**Implementation.** services/indictrans2 contains the authenticated bounded MT worker, Linux dependency lock, container and operator procedure. English input selects Hub revision 2cfd0a20057756d756bf3e53528f492afc52f91a and Telugu input selects d66a2122ad6d28184f3dc3797b652bd80ae3f65f. Both gated configuration HEAD requests returned HTTP 401 anonymously. scripts/s2st/mt-compare.ts compares confirmed text, validates fixture digests, checks directional worker receipts, records failures and emits blinded review files separately. Updated compare-directions.ts reuses the common audio decoder, retains completed offline evidence across paced failures and includes PCM and output WAV hashes. A further real two-direction fictional smoke verified all four digests in .sahva/directions-pajXIq.

**Evidence and limits.** Four isolated Python worker tests passed with a stub model, including invalid authentication, unsupported pair, input bounds, rate limiting and continued exclusion after a timed-out job. The draft preparation/validation smoke exercised missing reviewer, missing consent and modified PCM. No inference or quality result from the gated weights. The local host has Intel Arc graphics. The first Docker build lost its engine connection. The bounded retry locked and installed 77 packages and successfully initialized IndicProcessor inside the CUDA image. The built manifest is 3a6de6fed0c400d290265258592a574da9306e1a2a968db25d29f75b840df62c.

**Human evidence.** Private replay and checked-reference export are in .sahva/mt-fixtures-15rJEs/review.html. Rebuild using scripts/s2st/fixture-review.py with the private fixture directory. All 10 originals, canonical PCM hashes, durations and links were verified. Chrome exported the selected test row without modifying a real review. The offline small Whisper CPU cross-check used revision 536b0662742c02347bc0e980a01041f333bce120 with a supplied language. The English readings exposed possible location, question and mixed-language errors; all five Telugu readings were empty. Earlier MKL allocations failed. These readings do not establish speaker intent. Automatic approval review rejected the new personal-voice upload to Sarvam pending specific authorization. The newly supplied phone recordings were processed locally only.

**Infrastructure and decision.** GPU uptime 0 h and cloud GPU expense $0. The workshop account has zero applied G/VT On-Demand and Spot vCPUs in Oregon and N. Virginia. Oregon g4dn.xlarge (T4) is $0.526/h and g6.xlarge (L4) $0.8048/h Linux On-Demand. Both require four available G/VT vCPUs. The operator accepts a 24 GB candidate and requires stop when idle, start for approved sessions. The AWS runbook specifies verified stop, encrypted EBS retention, deadline and idle costs. Quota submission and capped launch remain pending. Keep the hybrid lab preset and LiveKit trial gated until real translation and human review. Next run the confirmed fixture pairs on Sarvam and the private worker. No Maya or ASR replacement approved.

**20:05 IST container verification.** Docker build completed with image ID sha256:51a1a099f50c825f565bdb7ab4c8ca9611df6a6e38387eb4c62a3d79fff3d9a7. Running it with network disabled, a read-only root and no published ports verified Torch 2.6.0+cu124, CUDA runtime 12.4, Transformers 4.51.3, all four application routes and nonempty official preprocessing in both directions. Local CUDA device availability returned false. The smoke container exited. No checkpoint generation was claimed.

---
## [2026-11-21 21:01 IST] — GPU-02 / LAB-02 · Oregon CPU translation pilot — VERIFIED for fictional text

**Checkout and scope.** Codex, D:/Develop/Builders 2026/sahva_project_pack, main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f tracking origin/main. At handoff 23 tracked files are modified and 116 untracked files are present, with nothing staged. Existing work preserved. No commit, application deployment, migration or LiveKit change. Previously recorded production image c7011ab. The authorization was for one Oregon c7i.2xlarge session of up to two hours, followed by stop.

**Infrastructure and access.** AWS Organizations blocked the G/VT quota increase. The Standard quota permitted the CPU instance. The operator accepted both Hugging Face access gates. Signed-in CLI downloads verified 13 files at English-input revision 2cfd0a20057756d756bf3e53528f492afc52f91a and 12 files at Telugu-input revision d66a2122ad6d28184f3dc3797b652bd80ae3f65f. Safetensors SHA-256 values were 0039e4304e9889acc5c8350a193311d07aa5399b6d9fb0445e8fde19e3533bb5 and a9bff20ae94712db41c8dc99d2e381eb456ddccbcd48cb2c7cf077ccc5bc58d8 respectively. All 25 file digests were checked again on EC2. The temporary SSH rule was operator-IP-only, the host key matched the authenticated EC2 boot log and the worker port was bound to loopback. The experiment ran without a Hub credential on the instance.

**Implementation and verification.** The worker accepts explicit CPU FP32 and keeps the existing CUDA FP16 default. The existing mt-compare runner accepts a fixed fictional-script cohort from the same recording sheet used for fixture intake. Fictional receipts carry a null PCM hash. All ten donated original and decoded PCM hashes matched; the draft recording manifest still failed reviewer/consent validation before any provider call. Typecheck, lint, Next build, 23 Vitest tests and the offline CPU device regression passed. The network-disabled clean Docker build needed package metadata. Its normal-build retry succeeded. Actual offline local generation succeeded on both pins. A ten-prompt local paired smoke made 20 successful requests.

**Oregon results.** The worker image was sha256:bdfbb567c81209c6d073cc9c403e2a6c5ba80dbb4fafa411819b4fc452c3a7fd. The --fictional paired 3 run produced 60 successful receipts, 60 distinct request IDs, ten matched source-text digests and 30 unscored blind reviews. Each engine and direction had 15 observations. The timing table and critical-meaning observations are in qa/S2ST_BENCHMARK.md under Oregon CPU translation trial. Private receipts and the editable blind-review.md are in .sahva/mt-comparison-oTWob5. Host measurements and the instance ID are in .sahva/oregon-cpu-01/run.json.

**Cost and stop.** AWS reported launch at 15:18:39 UTC. The guest powered off immediately after measurement. At 15:29:55 UTC AWS showed stopped, no public IPv4, and the retained encrypted 32 GiB gp3 disk. The trial security group then had zero inbound rules. Launch to verified stop was at most 11m 16s, about $0.067 compute at $0.357/h, plus IPv4 and EBS. This is an estimate, not an invoice. GPU hours and GPU cost were zero. The verified guest poweroff guard had been armed for 100 minutes from boot.

**Decision and next work.** Keep Sarvam as the live provider. IndicTrans2 reversed the code-mixed release prohibition on all three English-input repetitions, while Sarvam dropped the 150-rupee amount on all three Telugu-input repetitions. Have a fluent reviewer adjudicate the blinded outputs and extend the critical-negation cohort before any adoption decision. Personal recordings still need checked source/target text and processor consent. Recheck budget, current operator IP, host identity, credentials and stop guard before any future authorized start. The approved CPU session has ended.

---
## [2026-11-21 21:40 IST] — LAB-01 / GPU-03 · Speaker review and Maya preset-voice pilot — PARTIAL

**Checkout and scope.** Sahva main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f tracking origin/main, with existing unstaged and untracked experiments. No commit, production deployment, new AWS session or paid GPU provisioning. The previous Oregon EC2 trial ended stopped. ADR-0005 remains the live room decision and ADR-0008 remains experimental.

**Speaker review.** Verified all ten donated original-file and canonical-PCM digests. The local review page plays five clips per direction and lets the speaker correct both texts and the critical facts. Separate unchecked choices govern corrected source text for Mayura and local IndicTrans2, original audio for the Sarvam pipeline, and verified target text for Bulbul and public Maya Studio. Sending the original voice to Maya is outside these permissions. The export was tested with five scope combinations and an empty selection. At this checkpoint no new speaker-reviewed manifest had been exported. None of the ten donated recordings or their corrected text were sent to a provider.

**Maya evidence.** New scripts/s2st/tts-compare.ts reused the recording sheet, audio utilities and preset voice registry. Two repeats of ten fictional text inputs were planned. Bulbul v4 Flash completed 20. Maya 2 Native Studio completed two matched samples using Sreekar, then rejected a request on its hosted GPU quota. A further 17 Maya calls were skipped. Studio revision 1d9453d8e7cd5ab0a75eac44b623046847d9fce9; published model revision 87a83efdd6551e038246b6b37836a6264713eec3, deployed revision unavailable. English first PCM was 25,677 ms on Maya and 386 ms on Bulbul for the matched case; Telugu was 1,481 ms and 390 ms. The public demo includes queue and network overhead. No Sahva GPU utilization or self-hosted Maya latency was measured. Offline independent Whisper-small recovered the two English quantities and prohibition for both voices. Its Telugu readings were unsuitable for scoring. Human ratings remain empty. Private WAVs, SHA-256 digests, machine readings, timings and the blinded listening form are in .sahva/tts-comparison-F0KtYa. The canonical table is in qa/S2ST_BENCHMARK.md under Maya and Bulbul preset-voice trial.

**Regression evidence.** npm run typecheck, npm run lint, npm run build and all 23 Vitest tests passed. Four offline browser tests passed. All five isolated Linux worker contract and CPU tests passed; a duplicate native Windows invocation stalled and was stopped. The live-provider browser test accepted an optional isolated clip directory and passed using four fictional synthesized clips. It verified four stored turns, four voice playbacks, one speaker correction and four matching bilingual report items. No personal recording was used in that regression.

**Decision and resumption.** Keep Mayura and Bulbul as production defaults. Compare the reviewed human texts against both translators on the local worker, score meaning separately from latency, and use approved original audio to locate recognition errors. Allocate human listening scores separately from automatic metrics. Maya requires more repeated listening and timing trials; use the reviewed scopes before any personal target text goes to the public Studio. No restart of the Oregon instance is required for the local MT comparison.

## [2026-11-21 22:23 IST] — GPU-03 · Blind voice review received — PARTIAL

On main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f, verified four WAV hashes and their input text digests against the two matched pairs in .sahva/tts-comparison-F0KtYa. Archived the original review separately under human-reviews, SHA-256 b5a9b551c3327d21e0b5d1c7a81ef0a691aba7cc730d5dc87a6b1bb77676d3b6. One listener preferred Maya Sreekar in English and Telugu; the QA report records the unblinding. No new inference, EC2 runtime, deployment or commit. The speaker-confirmed recording reference export and processing scopes are still pending, so the personal-recording MT benchmark remains open.

## [2026-11-21 22:34 IST] — LAB-01 / GPU-02 / GPU-03 · Reviewed human recordings — PARTIAL

**Checkout and authorization.** Main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f tracking origin/main. Existing uncommitted work preserved. Archived the speaker-confirmed export beside the ten canonical WAVs. Original and PCM digests, direction, sample count and authorizations matched for all ten. The human references retained the original prompt wording. No application commit, deployment, model promotion or AWS restart. Cloud compute uptime and charge for this session were zero; retained storage remains billable.

**Evidence.** The existing paired MT runner completed 60/60 calls on the checked sources using Mayura v1 and the local FP32 worker (English-input SHA 2cfd0a20057756d756bf3e53528f492afc52f91a, Telugu-input SHA d66a2122ad6d28184f3dc3797b652bd80ae3f65f). Audited request uniqueness, matching input and audio digests, and three repeats per model and fixture. The local worker stopped. The Sarvam full file and paced pipeline completed on 10/10 clips in each mode. A second network-disabled local container translated all ten paced ASR outputs for stage attribution. See qa/S2ST_BENCHMARK.md for measured timings, critical errors, two-path evidence and run paths. The private single-file report contains ten clip panels and 20 audio players and was served successfully on loopback.

**TTS and decision.** Verified earlier audio hashes against all ten checked target texts for Bulbul and two for Maya. Eight additional Bulbul WAVs completed. Public Maya Studio denied one further request on its quota; seven were skipped. Keep Mayura and Bulbul in production. Sreekar remains the listener-preferred voice on the small reviewed subset. Prioritize evaluation of speech recognition on the price, name and code-mixed examples and obtain more blinded voice samples before promoting a hybrid. Current findings are engineering review against speaker-confirmed references. No new bilingual scores for translated outputs were supplied.

## [2026-11-21 22:43 IST] — Three-language demo direction — PROPOSED

On main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f, checked English/Telugu room contracts and the existing Hindi lab evidence. Ran file-based provider smoke on three fictional recordings in all six directions with Mayura and Sarvam Translate v1. All twelve generated WAVs decoded with speech energy. Additional text tests included twelve Hindi-source A/B calls and twenty candidate English/Telugu-source translations. The demo rehearsal recommendation and observed meaning errors are documented under Three-language demo direction in qa/S2ST_BENCHMARK.md. No production change, commit, new EC2 session or GPU usage. Hindi room integration, bilingual adjudication, voice sign-off and six-direction LiveKit playback remain open.

---
## [2026-11-21 23:04 IST] — STREAM-01 / GPU-02 · Three-language meeting checkpoint — PARTIAL

**Objective and result.** English, Telugu and Hindi participants can speak in the same LiveKit room. The room transcribes once, uses Sarvam Translate v1 for each distinct listening language, and keeps original recordings, source attribution and revision-specific deliveries. Maya Sreekar is the chosen Telugu demo voice. The operator rejected Kavitha as well as Pooja. In meetings that include Hindi, a missing Sreekar service leaves Telugu captions and original replay available. No alternate voice is substituted. Summaries remain English/Telugu. The working two-person phrase baseline retains Mayura.

**Implementation and tests.** Migration 006 expands participant languages and records per-target delivery timings. It ran in an isolated local Linux database. The existing three-profile Chrome harness exercised all six directions on real LiveKit Cloud and Sarvam with fictional microphone recordings. Audio routing control: 6/6 browser playbacks with Bulbul. Final Sreekar policy with no private service: 6/6 correct-language caption deliveries, 4/6 actual browser playbacks, both Telugu outputs explicitly unavailable, and a ready empty report for three repetitions of the same instruction. The original test incorrectly required an evidence citation for this empty report; the harness now checks readiness and validates any evidence that exists. A separate older three-seat scenario passed overlapping microphones, same-language original playback, consent withdrawal, reconnection and report evidence. Details, scope and raw measurement definitions are in qa/S2ST_BENCHMARK.md.

**Regression evidence.** Type checking, lint, production build, all 25 Vitest cases, four offline Chrome tests and all five Python worker tests passed. The local worker test container required test-only httpx 0.28.1. The real-room candidate needed a fresh preview process to load changes to both the UI and interpreter. No personally recorded speech was used for these calls. Only the production Hindi voice-picker preview is a public audio artifact.

**Human evidence and blocker.** The blind test rated one English and one Telugu synthesis pair, separate from model translation testing and provider timing. The operator chose Sreekar. Telugu first decoded audio was 1.481 s in the earlier successful Maya Studio sample. A new fictional Telugu Studio probe returned a GPU quota error and zero audio. No hosted Maya key is available. Private Maya native service connectivity and all-six audio with Sreekar remain unverified. Before enabling it, configure the authenticated private native endpoint, test repeated Telugu outputs from English and Hindi, and run the six-route rehearsal without --telugu-captions. Costs and live GPU behavior remain unmeasured. No cloud compute instance was launched or restarted in this phase.

**Version and operations.** Work started from main at 3655e761e7ccdac43dbafb9b8bfa82e558a7dd1f. The Oregon public host was inspected directly and ran c7011ab2b809f10d44caed15eb19ca787d06ef14 with its updater timer active. The Git checkpoint includes the model lab, evaluation documentation, model-worker sources and three-language candidate. Private credentials, source recordings, exports and model caches remain on the operator's machine. The unrelated frontend design pack and its separate worktree are outside this checkpoint. Read the latest ledger entry before any public rollout.

---
## [2026-11-21 23:08 IST] — STREAM-01 · Tarun accepted for Telugu demo

The operator authorized an available substitute and approved the Tarun audition. The private Sreekar integration remains an optional operator-configured trial. Hindi-enabled meetings with no available Sreekar worker use Sarvam Bulbul v4 Flash tarun_te_narration for Telugu. The app displays the actual Telugu voice, and the smoke test requires the expected voice ID from both English and Hindi sources.

A fresh three-profile LiveKit Cloud call on the isolated Linux host produced six attributed translated captions and six actual browser playbacks. Both Telugu outputs were verified as Tarun. See qa/S2ST_BENCHMARK.md for all six measurements. Production build, lint, 25 unit tests and four browser regressions passed on the fallback candidate. The accepted five-second Tarun preview and the short Hindi preview use fictional text. No personal speech, new GPU or Maya charge. Prepare a fast-forward main release and verify the public site with the same three-profile call after the Oregon updater finishes.
