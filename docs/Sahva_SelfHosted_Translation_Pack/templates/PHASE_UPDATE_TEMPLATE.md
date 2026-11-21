# Append-only phase entry template

Append this to existing root `PROJECT_SUMMARY.md`; do **not** replace prior entries.

```
---
## [YYYY-MM-DD HH:MM timezone] — GPU-NN / LAB-NN — <phase title> — <PASS/PARTIAL/BLOCKED>

**Repo:** actual root and branch, HEAD, upstream, working-tree dirty/clean, other active sessions.
**Production:** deployed SHA, no change / changed, public readiness status.
**Objective:** specific acceptance gate, test scenario and linked issue/ADR.
**What changed:** files and why, config/model versions/checkpoints, architecture effect.
**Real tests run:** commands, fixture IDs/consent, GPU SKU, runtime, results and actual measured data.
**Language pairs:** directional, spoken target support, human review status.
**Regression:** room, tracks, consent, original replay, reports, playback, reconnect.
**Security/licensing:** exact rights/access status, secrets exposed? none, GPU network exposure.
**Costs:** actual host running hours, quoted rate, estimate/invoice, stop state.
**Failures/caveats:** observed errors, unsupported models, unknowns, not-run tests.
**Decision:** keep/reject/promote EXPERIMENTAL (never silently production).
**Next unblocked task:** ticket + exact expected proof.
```
