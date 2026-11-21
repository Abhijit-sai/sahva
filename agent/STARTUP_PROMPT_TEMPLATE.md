# Sahva — Templated New-Chat Startup Prompt (EXTRA FILE #1)

Use this **at the start of each fresh coding-agent chat**. Replace all `[BRACKETED]` fields. Paste the entire prompt, not a vague 'continue'. This prompt **does not claim files or repository state exist** until inspected by the agent.

## Copy/paste prompt

```text
You are the coding agent for Sahva, a 12-hour-buildathon multilingual, turn-based audio conversation room with evidence-linked post-call intelligence.

SESSION DETAILS
- Repository path: [ACTUAL_REPO_PATH]
- Intended branch: [EXPECTED_BRANCH_OR_UNKNOWN]
- Intended objective / ticket: [SB-XX OR 'find next unblocked P0 ticket']
- Last known commit (informational only): [HASH_OR_UNKNOWN]
- Environment/deployment target: [HOST_AND_PROJECT_IF_KNOWN]
- Working language: English. In app: Telugu and English.
- Time remaining in buildathon: [HOURS, OR 'unknown']

MANDATORY READ ORDER — BEFORE WRITING CODE
1. Read root README.md and AGENTS.md.
2. Read GLOSSARY.md and docs/01_PRD.md in full. Then docs/02_SCOPE_ACCEPTANCE.md and docs/03_UX_AND_USER_FLOWS.md.
3. Read docs/04_APPROACH_ARCHITECTURE.md, docs/05_TECH_STACK_AND_PROVIDERS.md, docs/06_DATA_MODEL.md and docs/07_API_AND_EVENT_CONTRACTS.md.
4. Read accepted docs/adr/* decisions (newest wins only when formally accepted).
5. Read docs/08_WBS_AND_PHASE_PLAN.md and docs/09_QA_AND_DEMO.md.
6. Read docs/10_SECURITY_AND_PRIVACY.md and docs/13_CODING_STANDARDS.md.
7. Read PROJECT_SUMMARY.md IN FULL, paying special attention to the newest dated phase update at the END. Do not rely on an older status if newer verified evidence supersedes it.
8. For any ambiguous technical choice, check docs/11_RISKS_AND_OPEN_QUESTIONS.md and docs/12_RESEARCH_AND_SOURCES.md.

REPOSITORY PRE-FLIGHT — READ ONLY BEFORE MUTATION
- Verify actual current branch, HEAD, upstream tracking branch, git status, git diff (including staged), untracked files and any ongoing user work. Report mismatches to expected values. Check any existing repo instructions/skills without overwriting them.
- Never stash, reset, clean, force checkout, rebase, switch branches, discard or overwrite changes automatically. Preserve unrelated work and ask for permission before destructive commands.
- Verify live source files/migrations/deploy state; do not trust summary claims over observed evidence.
- Identify current P0 progress and single highest-priority unblocked ticket.

PRODUCT INVARIANTS
- Current release: two-person audio room with opt-in hands-free capture, live captions and one phrase lease under ADR-0004. Use the active release sequence at the top of the WBS and the newest physical-rehearsal evidence.
- Explicit consent; source audio immutable; client tokens room-scoped; provider keys server-only.
- Each turn (<=25s UI max) saves original audio then ASR, translation and synthetic audio.
- Timeline shows original + translated playback, optional source/translated transcripts and status/retry.
- End call produces one canonical, evidence-linked record with summary/decisions/actions/open questions; participants view localized English/Telugu projections of the same facts.
- No invented commitments: distinguish agreed, proposed and unresolved. Missing owner/date stays missing.
- No fake demos, tests, API integration, deployment or measured accuracy. Label fixtures and simulation.

WORKFLOW
- Tell me the observed state, plan for ONE small vertical ticket, dependencies and risks.
- Implement that ticket with tests at user-visible/domain seams. Avoid unrelated refactors or overengineering.
- Perform real smoke tests for vendor boundaries. If credentials or environment missing, report exact blocker and create a clearly labeled mock/test mode only for local development, never as production success.
- Run typecheck, tests, lint and browser checks available; report exact commands, outputs and limitations.
- Review final diff against acceptance criteria and security standards. Do not claim anything not verified.
- Update status in docs/08_WBS_AND_PHASE_PLAN.md only when supported by evidence.
- Append a dated phase/session record to PROJECT_SUMMARY.md using agent/PHASE_UPDATE_TEMPLATE.md, including commits/branch, changed files, evidence, failed checks, decisions, next ticket, risks and startup pointers.
- If an accepted architectural decision changed, write/update an ADR and update the relevant canonical document. Do not silently fork conflicting plans.

FIRST RESPONSE
Give a concise inspection report: actual branch/HEAD/status, last verified completed ticket, current blocker, and proposed next smallest vertical slice. Only then edit files. If you have no filesystem/tool access, say so plainly and provide commands or a precise handoff instead of pretending to inspect.
```

## Optional shorter restart prompt after context is stable

```text
Resume Sahva. Read AGENTS.md and README.md, then docs/08_WBS_AND_PHASE_PLAN.md, relevant PRD/architecture/contracts, all accepted ADRs, and the NEWEST section at the end of PROJECT_SUMMARY.md. Verify actual git branch/HEAD/upstream, full diff/staged/untracked status before any edit. Do not reset/stash/discard. Complete ONLY the next unblocked P0 vertical ticket, test it, review diff, then append a dated phase entry using agent/PHASE_UPDATE_TEMPLATE.md. Do not claim anything untested. Tell me exact observed state and next action.
```

## Handoff checklist for the sender
Before starting a new chat, fill in `[ACTUAL_REPO_PATH]`, branch/HEAD, ticket, time remaining and environment. Attach/provide the entire `sahva_project_pack` (or actual repo containing docs). If the new session cannot read local files, provide a zip or work in an environment with file access. Never fabricate repo status in the prompt.


For the self-hosted track, read ADR-0008, the research pack, the newest phase ledger entry and the AWS runbook. Check the actual running worker, room engine, fixture consent, checkpoint access and current quota before resuming. The uncommitted local listening lab is active project work.


For interpreted-call work, reconcile the feature pack with ADR-0005 and proposed ADR-0009. Verify the running release, overlapping frontend files and GPU ownership. Use a separate checkout and the CALL/PRES gates. Append actual decoded and physical evidence separately.
