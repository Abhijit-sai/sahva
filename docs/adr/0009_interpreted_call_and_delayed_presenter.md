# ADR-0009 · Interpreted call output and delayed presenter media

Proposed · 21 November 2026. ADR-0005 governs deployed group rooms. ADR-0002 governs reports. ADRs 0006–0008 describe independent model trials.

Group microphones already reach a single-process interpreter. The receiver currently polls the timeline and decodes a completed private recording. Evaluate a second LiveKit connection scoped to each authenticated recipient and consent epoch. It carries worker-published audio from committed remote speech. Preserve the source room’s microphone-only human grants, captions, revisions and optional replay. A disabled feature flag selects the deployed path. Measure the extra connection cost and sharing of inference by target and voice before rollout.

After verified call output, compare per-language time-shifted renditions with shared buffered video plus separately scheduled translated audio. Both use source media timestamps, language-specific delay, discontinuities and a bounded buffer. A fixed wall-clock delay cannot align variable translated durations. See the [architecture](../04_APPROACH_ARCHITECTURE.md), [QA matrix](../09_QA_AND_DEMO.md) and [release gates](../08_WBS_AND_PHASE_PLAN.md).

Acceptance needs physical two-way and three-listener routing, acoustic and consent evidence, and recorded/live presenter marker distributions. Production defaults and model promotion each require separate review.

## Proposed room-scoped Gemini mix · 22 November 2026

For the owner's radio-style call trial, keep both microphones open independently. The worker forks each consented microphone before changing its gain. One continuous Gemini session interprets that microphone for each distinct remote listening language. The listener receives a private mixed publication per remote speaker. Speech in the listener's own language passes through at its original level. The archive processes source audio separately.

The radio reference lowers source gain to 0.2 while translated chunks are queued. The trial uses the owner's requested 0.1 during voiced translated playout, with a short attack, hold and release. Gemini's own voice plays at unity gain. Long-call session recovery, acoustic echo with open speakers, interpretation quality and cost remain release gates. This is a proposed experiment on one explicitly selected interpreted room.
