# Risks, Assumptions and Decision Queue

## Current release risks

The laptop speaker reported acceptable translation and difficulty associating voice, caption and original with the same message. Verify the redesigned thread on both devices. The language direction, phone browser and audio route still need recording. Check mobile audio suspension, missed onset and speakerphone feedback first. A larger synthetic sample cannot close this gate. Hosted database timings in the phase ledger were collected from the workstation. Repeat on the deployed host. One Node relay holds live session state in memory, so a process restart can interrupt a phrase. Speaker-selected style and streaming revision experiments must preserve original recordings and report evidence. The Oregon host is reachable and the operator selected the original Tokyo project. Public DNS, trusted HTTPS and regional call latency still require verification.

## Risk register

| Risk | Likelihood / Impact | Mitigation | Trigger for scope cut |
|---|---|---|---|
| Bidirectional Telugu-English output poor | M / Critical | Test two real clips and terminology in hour 1; corrections, source replay | If one direction fails, fallback to text+original replay; no false two-way claim |
| High latency makes 'call' awkward | H / High | Turn-based design; progress states; bounded recording; measure real latency | If >20s per 10s turn consistently, demo asynchronously, label honest delays |
| Audio codec mismatch | M / High | Check `MediaRecorder.isTypeSupported`; Sarvam accepted formats; convert server-side only if needed | If upload fails, use WAV conversion or tested browser format |
| Provider key/rate limit/outage | M / Critical | Account check first, deterministic stubs for development, no fake live demo | Provider unavailable -> partial voice-note product and disclosed limitation |
| Serverless timeout between stages | M / High | Test first-hour deployment; bounded worker/task queue | If can't finish within request, shift to supported worker; do not fire-and-forget |
| Summary invents commitments | H / High | Evidence-linked schema, conservative statuses, unresolved items | Remove auto action summary if cannot validate reliably |
| Translation changes amounts/names | M / High | Original always accessible, speaker correction, glossary/keyterms P1 | Show ambiguity, prompt confirmation |
| Room token leaks audio | M / Critical | Scoped short-lived tokens, hash invite, private signed media | No public deployment without access tests |
| Recording consent missing | M / Critical | First-class visible join consent; block record until accepted | Do not demo with unwitting participants |
| Time spent on visual polish | H / High | Phase gates; no video, billing or animated UI | At hour 8 freeze scope |
| Multi-person overlapping voices | H / High | P0 only speaker-triggered discrete turns | Multi-speaker room postponed |
| Browser autoplay refusal | H / Medium | Tap-to-play fallback, test Chrome and headphones | Use explicit play controls |
| Competitors already translate meetings | H / Medium | Differentiate with original-turn evidence, same record in two languages, careful commitments | Never claim 'first translation platform' |

## Assumptions approved for planning (not confirmed by user)
- Two participants and Telugu/English are adequate for the live demo.
- Turn-based voice turns are acceptable for the first build rather than truly simultaneous audio calling.
- Guest join (no email/password) reduces setup friction; room tokens protect resources.
- Short retention is preferred but must be honest about implementation.
- Sarvam and an LLM key can be obtained at event; no credentials are supplied with these docs.
- No pre-existing Sahva repository, branch, deployment or migration may be assumed.
- Demo users and recordings are consented; no commercial/production guarantees.

## Questions that can be answered during setup, without blocking documentation
1. **Provider access:** Does team have active Sarvam API key/credits and an LLM API key? What are quotas? (blocks integration at H0)
2. **Repo destination:** GitHub repo and local path/branch? (agent must inspect actual state)
3. **Deployment:** Vercel/Supabase projects or alternative worker environment? (blocks deployed E2E)
4. **Demo devices:** two laptops/headphones and at least one fluent Telugu speaker? (blocks reliable human eval)
5. **Data retention:** Should room data be deleted immediately after event or after a clearly disclosed short period? (blocks production-grade deletion claim)
6. **Brand:** Can 'Sahva' be used for the event pending later trademark/domain verification? (not a technical blocker)
7. **Track selection:** Voice AI for India versus SaaS in a day? Confirm requirement to show same recordings base vs system.

## Decision record protocol
- Document chosen option, alternatives, consequences, owner, date and acceptance status in an ADR.
- A pending question is **not** a blocker unless it affects the next ticket. Don't ask all questions again in each chat.
- If a decision modifies user-facing capability, update PRD and acceptance criteria after ADR approval.
