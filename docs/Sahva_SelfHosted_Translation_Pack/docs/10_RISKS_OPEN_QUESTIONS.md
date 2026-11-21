# 10 — Risks, open questions and decision log

| Risk | Severity | Evidence / concern | Mitigation | Gate |
| --- | --- | --- | --- | --- |
| Poor meaning from early segmentation | Critical | Context may arrive late; negation and Telugu word order | Stable-prefix commit, buffer, protected words, human validation | benchmark E1+E4 |
| GPU costs exceed API costs | High | Idle billed worker plus egress | Time-box host, budget alerts, compute $/successful minute | GPU-01/10 |
| 24GB VRAM insufficient for combined MT+TTS | High | Bodhan ~15.9GB weights, Maya ~9.2GB peak separately | Split stages/hosts; use distilled MT first | GPU-05/08 |
| Model license incompatible with SaaS | Critical | Bodhan hosted service conditions, upstream weights | Full legal review, use MIT/Apache alternatives until approved | GPU-12 |
| Existing public service regression | Critical | LiveKit/consent pipeline working | Feature flag, isolated worker, test room, no default swap | GPU-09/11 |
| Self-hosted ASR not truly streaming | High | Offline checkpoints require windowing | Retain Saaras for live ASR; benchmark ASR offline separately | GPU-07 |
| Voice cloning misuse | High | Voice biometrics and imitation | Separate explicit opt-in/identity controls, deletion | P3 only |
| Low-confidence facts silently altered | High | Names, dates, amounts, negation | Protected fields, alerts, source replay, correction | E1/E4 |
| Region/network delay dominates | High | Oregon app + remote LiveKit + new GPU | Place worker nearby, trace network stages | GPU-10 |
| Model updates change scores | Medium | mutable model revisions | Pin HF/containers, log hashes | all |
| Qwen or other research speech models lack Telugu output | Medium | language support differs for input vs output | Capability registry and human pair-specific checks | model registry |
| Excessive processing latency from validation | Medium | second-pass translation may double delay | route critical spans selectively, compare p95 and miss rate | E4 |
| Lab fixtures accidentally expose private data | Critical | recorded conversations contain personal data | consent, private artifacts, sanitized public demo, strict TTL | LAB-02 |
| Provider fallback invalidates experiment | Medium | silent routing change | mark failed run and explicit fallback | LAB-02 |

## Questions for a later phase — not blockers to begin
1. What exact GPU budget and maximum number of test hours are authorized? Default **no provisioning** without approval.
2. Do we need real-time output for only Telugu↔English, or include Hindi in this research? Default Telugu/English only.
3. How much concurrency is meaningful (1, 2, 6 simultaneously speaking, multiple listeners)? Start 1 then 2 then group.
4. How long may benchmark recordings be kept? Default to existing policy and a short experiment TTL only when confirmed.
5. Is the translated output allowed to lag more to protect meaning? Prioritize meaning; measure naturalness and queue backlog.
6. Can a GPU vendor process meeting audio in its region under the participants' consent? Review data transfer notices and terms.
7. Can Bodhan grant hosted-service permissions for SaaS usage? Need confirmation for ambiguous case.

## Explicit negative decisions
- No wholesale Sarvam removal.
- No new media server/LiveKit replacement.
- No production model auto-selection based on vendor charts.
- No single-GPU 24GB commitment to run Bodhan 15.9GB MT + Maya ~9.2GB peak simultaneously.
- No fine-tune before a verified failure taxonomy and enough consented labeled data.
- No public voice-cloning UI by default.
