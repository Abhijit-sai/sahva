# Sahva — Phase-wise Project Summary Template (EXTRA FILE #2)

## Purpose
A new coding-agent chat must be able to resume without losing decisions, implementation evidence or remaining work. The only **living progress ledger** is `PROJECT_SUMMARY.md` at repo root. This file provides the template; it is not the ledger. Keep history **append-only** and write a new update after every phase or session.

## Required update structure — copy and append at END of PROJECT_SUMMARY.md

```markdown
---
## [YYYY-MM-DD HH:MM TZ] — Phase [N]: [NAME] — [STATUS]

**Reporter:** [agent/person]  
**Actual repo/branch/HEAD:** `[path]` / `[branch]` / `[hash]`  
**Upstream:** `[upstream or none]`  
**Working tree:** [clean/dirty; staged/unstaged/untracked counts; preserve all external work]  
**Ticket(s):** [SB-XX]  
**Status:** [NOT STARTED | IN PROGRESS | VERIFIED | BLOCKED | PARTIAL]  
**Time remaining / deadline:** [value or unknown]

### Objective and user-visible result
- What the phase sought to deliver:
- What can a user demonstrably do NOW:
- What is **NOT** working or verified:

### Implementation evidence
- Files changed or added (group by capability):
- DB migrations applied and how verified:
- External provider/API call(s) actually made, sanitized result/request ID:
- Deployment URL/build ID (if real):
- Commit(s), if committed, and why not if not:

### Test evidence (exact results only)
| Command / test / browser step | Result | Evidence / failure |
|---|---|---|
| `...` | PASS/FAIL/NOT RUN | ... |

### Decisions and deviations
- Existing ADR followed:
- New decision and ADR link (if any):
- Deviations from P0/spec and explicit reason:

### Risks, blockers and outstanding defects
- [severity] [issue]: [reproduction/impact/next step]

### Next agent / next phase
- Next highest-priority unblocked ticket:
- First files and commands to inspect:
- Environment/credentials still needed (names only, NEVER values):
- Definition of done for next phase:
- Explicitly preserved user changes / do-not-touch files:
```

## Update rules
1. **Append, don't overwrite.** Older summaries are evidence snapshots. Never silently change historical results.
2. State **NOT RUN** if not run. Code present != functional; deploy attempted != deployed; mock != real provider. Include actual failures.
3. Summaries report evidence; product intent lives in `docs/01_PRD.md`, acceptance in `docs/02_SCOPE_ACCEPTANCE.md`, decisions in ADRs, API contract in `docs/07_API_AND_EVENT_CONTRACTS.md`.
4. If status conflict is discovered, append a correction with timestamp and explain; do not rewrite the old entry.
5. New sessions start at the END of `PROJECT_SUMMARY.md`, then inspect current git/repo rather than blindly trusting an older summary.
6. If scope/architecture changed, create accepted ADR and update relevant canonical doc; don't bury an architecture reversal in progress logs alone.
7. Never include API secret values, user audio, personal transcripts, private invite tokens or signed media URLs.
8. Note working-tree dirt and unrelated files explicitly. Never erase user changes to make summary look clean.

## Phase names and expected gate evidence
- **Phase 0 — Ground truth / provider spike:** API and recording format tested, two directions attempted, decision to continue or fallback.
- **Phase 1 — Room and consent:** two participants plus auth/consent smoke.
- **Phase 2 — First tracer bullet:** record and replay source audio in second browser.
- **Phase 3 — Translation:** Telugu→English and English→Telugu actual audio demonstrated.
- **Phase 4 — Meeting intelligence:** evidence-linked report and localized versions.
- **Phase 5 — Stabilize and demo:** deployed 2-device QA, recording backup, unresolved issues disclosed.

## Example entry (CLEARLY FICTIONAL — do not append as factual history)

```markdown
## [EXAMPLE ONLY / NOT ACTUAL] — Phase 2: Original audio turn — PARTIAL
**Actual repo/branch/HEAD:** unverified / unknown / unknown
**User-visible result:** Example: A uploads a short audio clip and sees the card in A's browser.
**Tests:** NOT RUN on second device.
**Known gap:** Source audio does not yet play for B; no translation performed.
**Next:** Implement authorized signed playback and verify from separate browser.
```

**The actual `PROJECT_SUMMARY.md` ships with an explicit pre-build entry: no implementation or tests have occurred.**
