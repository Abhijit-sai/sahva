# ADR-0009 · Interpreted call output and delayed presenter media

Proposed · 21 November 2026. ADR-0005 governs deployed group rooms. ADR-0002 governs reports. ADRs 0006–0008 describe independent model trials.

Group microphones already reach a single-process interpreter. The receiver currently polls the timeline and decodes a completed private recording. Evaluate a second LiveKit connection scoped to each authenticated recipient and consent epoch. It carries worker-published audio from committed remote speech. Preserve the source room’s microphone-only human grants, captions, revisions and optional replay. A disabled feature flag selects the deployed path. Measure the extra connection cost and sharing of inference by target and voice before rollout.

After verified call output, compare per-language time-shifted renditions with shared buffered video plus separately scheduled translated audio. Both use source media timestamps, language-specific delay, discontinuities and a bounded buffer. A fixed wall-clock delay cannot align variable translated durations. See the [architecture](../04_APPROACH_ARCHITECTURE.md), [QA matrix](../09_QA_AND_DEMO.md) and [release gates](../08_WBS_AND_PHASE_PLAN.md).

Acceptance needs physical two-way and three-listener routing, acoustic and consent evidence, and recorded/live presenter marker distributions. Production defaults and model promotion each require separate review.
