# Sahva — Buildathon Project Pack

## Run and deploy Sahva

- [Run the application and tests locally](ops/LOCAL_DEVELOPMENT.md)
- [Deploy from GitHub to EC2, ship a patch or roll back](ops/AWS_DEPLOYMENT.md)
- [Verified implementation history and outstanding release gates](PROJECT_SUMMARY.md)
- [GitHub Actions](https://github.com/Abhijit-sai/sahva/actions) and [commit-tagged releases](https://github.com/Abhijit-sai/sahva/releases)

## Group meetings

A server with LiveKit enabled offers **Group meeting** under **Room type**. Create the room, share its invitation, and have each guest choose a speaking and listening language. Once two people have joined, select **Join meeting audio** on each device. Up to six people can join. English, Telugu and Hindi listeners see the same speaker’s message in their own language. **Original** opens its source recording and transcript. The roster stays beside the conversation on desktop.

The interpreter transcribes each participant’s microphone separately. Captions update during speech. Automatic playback uses archived audio or generated speech after a phrase becomes stable. Withdrawing consent stops interpretation for the room. Participants can consent again and reconnect their microphones. [Meeting setup and test](ops/LOCAL_DEVELOPMENT.md#livekit-group-meetings)

## Original buildathon planning pack

**Planning baseline:** Assumptions locked for a 12-hour prototype  
**Prepared:** 2026-11-21 (Asia/Kolkata)  
**Product:** A multilingual, turn-based audio conversation room that preserves original speech, provides translated speech and optional transcripts, and produces one evidence-linked meeting record displayed in each participant's preferred language.

> **North star:** Speak naturally. Understand everyone. Leave with clarity.

## Start here

1. **Any coding agent:** Read `AGENTS.md` and `agent/STARTUP_PROMPT_TEMPLATE.md`.
2. **Product destination:** Read `docs/01_PRD.md`, `docs/02_SCOPE_ACCEPTANCE.md`, `GLOSSARY.md`.
3. **Architecture and contracts:** Read `docs/04_APPROACH_ARCHITECTURE.md`, `docs/05_TECH_STACK_AND_PROVIDERS.md`, `docs/06_DATA_MODEL.md`, `docs/07_API_AND_EVENT_CONTRACTS.md`.
4. **Execution:** Read `docs/08_WBS_AND_PHASE_PLAN.md`, `docs/09_QA_AND_DEMO.md`, `docs/10_SECURITY_AND_PRIVACY.md`.
5. **Before modifying anything:** Read newest phase record at the END of `PROJECT_SUMMARY.md`, then current issues and branch state. See `agent/STARTUP_PROMPT_TEMPLATE.md`.
6. **After every phase:** Append a phase update to `PROJECT_SUMMARY.md` using `agent/PHASE_UPDATE_TEMPLATE.md`.

## Documentation map

| Source | Responsibility |
|---|---|
| `docs/00_PRODUCT_BRIEF.md` | Quick shared product narrative and demo story |
| `docs/01_PRD.md` | User problems, personas, stories, functional/nonfunctional requirements |
| `docs/02_SCOPE_ACCEPTANCE.md` | P0/P1/P2, acceptance criteria, release gates |
| `docs/03_UX_AND_USER_FLOWS.md` | Screens, interaction states, error and recovery flows |
| `docs/04_APPROACH_ARCHITECTURE.md` | Design decisions, dataflow, module boundaries, tradeoffs |
| `docs/05_TECH_STACK_AND_PROVIDERS.md` | Technologies, provider test gates, defaults, fallbacks |
| `docs/06_DATA_MODEL.md` | Domain entities, tables, access model, retention |
| `docs/07_API_AND_EVENT_CONTRACTS.md` | Proposed API, payloads, status transitions and idempotency |
| `docs/08_WBS_AND_PHASE_PLAN.md` | Vertical slices, dependencies, 12-hour checkpoints |
| `docs/09_QA_AND_DEMO.md` | Testing matrix, voice benchmark, demo script, go/no-go |
| `docs/10_SECURITY_AND_PRIVACY.md` | Consent, access control, disclosure, storage, deletion |
| `docs/11_RISKS_AND_OPEN_QUESTIONS.md` | Risks, contingencies and nonblocking assumptions |
| `docs/12_RESEARCH_AND_SOURCES.md` | Current external documentation and verification notes |
| `GLOSSARY.md` | Canonical domain terminology; code should mirror these names |
| `docs/adr/` | Decisions that change architecture or product invariants |
| `docs/13_CODING_STANDARDS.md` | Review-ready engineering standards |
| `AGENTS.md` | Compact, always-on coding-agent instructions |
| `agent/STARTUP_PROMPT_TEMPLATE.md` | **Extra file #1:** copy-paste prompt for new chats / sessions |
| `agent/PHASE_UPDATE_TEMPLATE.md` | **Extra file #2:** append-only phase / handoff update format |
| `PROJECT_SUMMARY.md` | Single living, append-only progress log — NOT a competing PRD |
| `ops/ENVIRONMENT_AND_SETUP.md` | Local setup, environment variables, deployment checklist |
| `qa/VOICE_TEST_CASES.md` | Reproducible Telugu-English evaluation cases |

## Approach adapted from Matt Pocock's public skills

We use the underlying discipline of `grill-with-docs` (align on terms and decisions), `to-spec` (write a shared destination), `to-tickets` (dependency-ordered tracer bullets), `implement` / TDD (small vertical slices) and review. This pack is **inspired by the published workflow**, not a claim that the actual skills have been installed or executed inside a repo. Official source: https://github.com/mattpocock/skills

Optional, **inside a real repo** with permission: install the published skill pack for your coding agent and run `/setup-matt-pocock-skills`. Do not run setup before inspecting existing files. This pack uses local Markdown tickets by default to avoid spending buildathon time configuring a tracker.

## Non-negotiable constraints

- P0 is **two-person, turn-based audio**, not simultaneous interpretation or PSTN calling.
- Telugu and English first. Each user chooses a listening language.
- Original audio is immutable evidence. Corrections are versioned interpretations.
- Consent before recording/AI processing. No hidden recordings.
- Do **not** invent commitments: distinguish agreed, proposed, and unresolved.
- Every action item links back to utterance IDs and speaker evidence; if not supported, omit or mark for review.
- Never present generated examples, deployment, API calls, benchmark improvements, or tests as already completed.
- Demo must work with two separate browser sessions and a fresh user-provided utterance.

## Buildathon success in one sentence

A Telugu-speaking user and an English-speaking user join one browser room, exchange voice turns, each hears the other's words in their selected language, and leave with consistent summaries and evidence-linked action items in both languages.

## Live interpreter demo

Create a room, then open its invitation in a second browser profile. Choose English for speaking and listening in one profile and Telugu in the other. Once both participants consent, each selects **Join audio call**. Take turns speaking and pause at the end of each phrase. The listener sees live captions and a draft translation, then hears the translated voice. The microphone automatically listens for the next turn.

Open **Audio options** for single-phrase recording and playback settings. Each incoming message shows the translated caption and replay in your listening language. Select **Original** on that message for the original recording and transcript.

With headphones, select **Using headphones · speak to interrupt playback** to start your reply while the translation is playing. **Mute microphone** releases your microphone. For a single phrase, use **Speak live** and enable incoming voice on the listener's side. Select **End call** to review the same meeting outcomes in either language and replay the supporting turns. [Delivery phases](docs/14_LIVE_DEMO_PHASES.md)


## Experimental self-hosted translation

Sahva’s public meetings use LiveKit and Sarvam. The local Translation Lab is the evaluation surface for the proposed private IndicTrans2 worker. Start with the [decision](docs/adr/0008_self_hosted_translation_eval.md), [phase plan](docs/08_WBS_AND_PHASE_PLAN.md) and [research pack](docs/Sahva_SelfHosted_Translation_Pack/README.md).
