# 08 — Security, consent, data handling and licensing

## Non-negotiables inherited from Sahva
- A meeting starts audio processing only with current explicit consent from participants, and consent withdrawal immediately revokes active recording/processing and delivery permissions for the current media epoch.
- Original audio and transcript remain private, participant-scoped and linked to evidence. Revisions must never silently rewrite original evidence.
- TTS output and transcript delivery must be limited to authorized listeners in the correct room and permitted language.
- Do not turn experimental providers on for production traffic by default.

## Threats added by self-hosting
1. **GPU endpoint exposed publicly:** authentication bypass, inference abuse and audio exfiltration.
2. **Foreign request streaming:** arbitrary file URL download / SSRF into the model worker.
3. **GPU DoS:** oversized audio, parallel requests exhausting VRAM, long-lived socket leaks.
4. **Leakage:** raw transcripts/audio stored in logs, traces, GPU temporary files, crash dumps.
5. **Malicious prompt or injected speech:** instructions spoken during a meeting should never control runtime, data access, model registry, routing or report safety.
6. **Voice identity misuse:** TTS voice cloning without speaker authorization.
7. **Model supply chain:** remote code in HF repos, mutable branches, dependency vulnerabilities, malicious artifacts.
8. **Regulatory/licensing:** model terms differ from source-code licenses; commercial API service and derivatives can trigger special permissions.

## Controls
- Private networking and TLS/mTLS or rotated server-side bearer credentials with short TTL; bound request to a room, person, model version and target language.
- Retain room consent checks on Node server and propagate a short-lived consent epoch token to GPU. Cancel and drop queues on revoke. Worker must enforce cancellation when possible.
- Encryption in transit; private object storage, expiring media URLs; no permanent download links. Avoid raw media persist on GPU disks; bounded ephemeral buffers and scheduled deletion.
- Structured redacted observability only: stage timings, request IDs, model IDs, failure types, audio duration, bytes, GPU utilization. Sensitive content only in authorized test artifacts.
- Rate limit per-room/per-worker, concurrency cap, timeouts, payload caps, queue deadlines, idempotency.
- Pin HF weights/config/tokenizer revisions and review `trust_remote_code` before allowing in container; scan SBOM and freeze dependencies.
- Opt-in voice cloning in a separate policy (identity confirmation, age/consent if applicable, revoke/delete voice, speaker attribution); do not make default voice mimicry automatic.
- Use sample contracts and public datasets only when dataset license and participant consent permit; document redistribution restrictions.

## License matrix (informational, not legal advice)

| Model/system | Reported license | Constraint to check |
| --- | --- | --- |
| IndicTrans2 distilled weights | MIT | model card gating, upstream preprocessing/dependencies |
| AI4Bharat IndicConformer | MIT | checkpoint-specific confirmation |
| Maya2-native/Maya3 weights & code | Apache-2.0 | Mimi CC-BY-4.0, Qwen-based backbone, notices |
| Bodhan Indic Translate | Indic Open Model License v1.0 | conditions on hosted APIs, derivations, attribution, upstream Gemma terms |
| Bodhan Indic Transcribe | Indic Open Model License v1.0 | hosted-service and other terms; upstream Canary terms |
| Meta Seamless checkpoints | Noncommercial for referenced research weights | not suitable for commercial SaaS without separate permission |
| UFAL SimulStreaming code | MIT | model checkpoints it invokes have their own licenses |

**Important nuance:** Sahva using a model behind its own product features is not necessarily identical to exposing that model as a standalone inference API. Do not infer permission from informal license summaries; review full binding text and consult rights holder for ambiguous hosted-service conditions.

## Privacy/retention design decisions to document
- What is retained: original audio, transcripts, translated audio, report, review annotations, selected model/version, consent state, timing metrics.
- How long retained: use existing Sahva policy, don't invent a blanket retention period; define optional lab shorter TTL and owner deletion.
- Who can access: speaker, authorized room members, admin testers under need-to-know; GPU host operators should not access production audio by default.
- Data geography: identify Oregon app, GPU worker region and Tokyo database, and document cross-region routes for voice data.
- External providers: some stages still call Sarvam even when MT self-hosted, so no claims of total on-premise privacy until every stage and storage is self-hosted.

## Release checklist
No public GPU port; health and auth tested; unauthorized/cross-room attempts rejected; consent revoke stops delivery; sample deletion verified; private log review; dependencies pinned; license approved; cost alerts enabled; production fallback works; incident/rollback owner identified.
