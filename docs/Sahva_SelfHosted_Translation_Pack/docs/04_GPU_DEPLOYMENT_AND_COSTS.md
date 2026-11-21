# 04 — GPU selection, deployment and cost model

## Recommendation
**Do not buy hardware or migrate the existing Oregon EC2 service.** Rent a **24GB NVIDIA GPU** (L4, A5000, RTX 3090/4090 class) for a time-boxed independent experiment; host the translation-only worker first. Use same/nearby region as the EC2 service when choosing a rental. A small CPU/app instance should not execute GPU inference.

| Phase | Worker | Initial hardware hypothesis | What must be measured |
| --- | --- | --- | --- |
| A: translated text | IndicTrans2 distilled 200M per direction | CPU or 8–16GB GPU; start GPU if low-latency | model load, peak VRAM, interactive P50/P95, throughput |
| B: voice | Maya 2 Native | 16–24GB GPU; vendor reports 9.2GB peak at one seat, H100 tests | L4/4090 warm/cold TTFA, stream stalls, TTS RTF |
| C: ASR | IndicConformer/Bodhan | Size/precision-dependent; validate | live chunking, stable text, memory, concurrency |
| D: larger MT | Bodhan Indic Translate | 24GB **minimum for MT alone**, 40GB+ for long docs | BF16 ~15.9GB weights + cache; real live decode speed |
| Combined | Multiple model workers | Separate GPU processes or 48GB+ with validated layout | total VRAM, allocator fragmentation, parallel traffic |

These are **sizing hypotheses**, not performance guarantees. Model cards report different GPUs, runtimes and concurrency profiles.

## GPU host alternatives
- **Runpod Secure Cloud / equivalent**: quick experiments, container/SSH, hourly GPU; best for temporary low-risk trials. As of the 2026-11-21 checked public pages, Runpod lists RTX A5000 24GB Secure Cloud ~$0.27/hr, L4 ~$0.69/hr, RTX 4090 ~$0.89/hr; actual region/availability/storage/egress/taxes vary. Pricing may change; verify at booking.
- **AWS EC2 g5/g6**: suitable if same cloud/network governance matters; do not assume cheapest or exact region price without inspecting the account's region pricing/quotas.
- **Dedicated GPU for always-on** only if usage warrants it. Stop workers after demos or use gated warm-time tests. GPU hosting isn't free at low traffic.

### Rough compute scenarios — illustrative only
For a **$0.89/hour GPU**, GPU runtime alone: 4 test hours ~$3.56, 20 hours ~$17.80, 24×30 hours ~$640.80. Excludes storage, network, taxes, provider surcharges, developer time, model cold start and infrastructure. For a $0.69/hr L4, a 720-hour month would be ~$496.80. Use a billing cap / automatic shutdown; don't leave experimental GPUs running indefinitely.

To compare against per-minute managed APIs, measure total *GPU wall-time* and concurrency, not only time while samples are synthesized. Compute cost per successful translated minute, including idle, retries, download/warmup and egress.

## Server topology
1. Existing Next.js/Node EC2 API remains the authenticated orchestrator.
2. Private GPU worker in the same region if possible; expose via private network/VPN or TLS endpoint restricted to authenticated backend.
3. Model containers mount persistent cached weights (pin HF revision), no arbitrary internet at runtime once initialized.
4. Run separate MT and TTS worker processes. Model concurrency must be explicitly bounded; queue overload yields a controlled error or fallback.
5. Record GPU telemetry (VRAM used, utilization, queue depth, cold load, request processing latency, errors) without logging audio contents.

## Suggested container and runtime controls
- NVIDIA Container Toolkit, fixed CUDA/driver matrix, lock Python deps; no `latest` image in deployment records.
- Non-root service user; read-only filesystem when possible; mounted model cache + dedicated tmpfs for temporary audio.
- Health: `/live` (process responsive), `/ready` (model loaded and inference probe), `/metrics` (private, sanitized).
- TLS, mTLS or signed internal tokens with per-request short TTL and audience claim; network isolation. No arbitrary raw file URL fetching.
- Request caps: max ~30s audio clips for isolated test; stage timeouts; per-room concurrency, max payload length, bounded websocket queues; explicit over-capacity handling.
- Rolling deployment requires new worker warming and readiness before routing any live call. Keep fallbacks.
- Stop the host when done, alert on sustained bill or idle hours.

## Region and latency
The public Sahva app runs in Oregon, while some persisted data is reported in Tokyo; LiveKit Cloud track region may vary. Instrument and select based on **mic→ASR**, **stable segment→MT**, **text→first TTS audio**, **GPU RTT** and **listener playback start**, not generic ping. A distant cheap GPU can negate an MT speed gain.

## Capacity testing
- Start at **one speaker and one target**. Then 2 simultaneous speakers, and finally a 3-listener group with two target languages.
- Warm-run at least 20 minutes and record p50/p95, GPU memory, queue backlog, dropped frames.
- An apparent 6-seat room is not the same as 6 concurrent audio translators in all possible languages. Plan for per-target deduplication and TTS voice fanout.
- If queue falls behind by >2 utterances or projected lag passes a configurable threshold, visibly warn and consider moving to phrase-based fallback.

## Rollback
Disable `SELFHOST_TRANSLATION_ENABLED` / remove lab routing at the server, keep existing Sarvam default. Verify a fresh two-direction public call, original replay, consent revocation and report after reverting. Do not change DB migrations solely for model routing unless unavoidable; if changed, migrations must be forward-compatible.
