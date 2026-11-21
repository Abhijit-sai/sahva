# 11 — GPU operator and experiment runbook

## Before making changes
1. Read `AGENTS.md`, latest `PROJECT_SUMMARY.md`, active ADR, branch/HEAD/upstream, full Git status/diff/untracked and existing provider work.
2. Confirm no parallel Codex session owns the current working tree or deployment.
3. Read current `scripts/compare-directions.ts`, provider code and inference runtime.
4. Confirm budget approval and provider account permissions before provisioning.
5. Check latest model revision, accepted model license, upstream packages and download token handling.

## Time-boxed GPU setup (conceptual, not a pasted vendor-specific provisioning script)
- Create private GPU host: Linux x86_64, compatible NVIDIA driver/CUDA, 24GB L4/4090-class test machine, close to Sahva app; GPU auto-stop after experiment window.
- Use a dedicated unprivileged user/container; never expose a public unauthenticated inference port.
- Install/pin one model family per worker, mount model weights read-only, ensure adequate disk, test `nvidia-smi` and sample translation.
- Add private endpoint credentials to secrets manager or secure env, **not** Git/GitHub Actions stdout or browser env.
- Set budget alerts and a shutdown schedule. Document GPU SKU/hourly cost and region.
- Use `GET /ready` that performs a real warm-model check, not merely HTTP 200 process response.

## First model smoke — IndicTrans2
- Pull both direction-specific distilled checkpoints. Run official processor/tokenizer workflow, right script and language codes (use `tel_Telu`/`eng_Latn` as verified by installed model processor; never reuse Sarvam `te-IN` blindly).
- Translate known texts with negatives, proper nouns and quantities; compare to reference. Record revision and average stage latency over at least 10 warm runs per direction.
- Ensure baseline MT text is fed into the new model exactly once, with no hidden silent preprocessing that changes meaning.
- Return model ID, SHA, elapsed timings and output. Reject unsupported pairs.

## Second model smoke — Maya
- Confirm exact package/import and CUDA/torch compatibility. Warm weights, synthesize the *same verified* Telugu and English text as Bulbul.
- Stream chunks into a file and decode; verify 24kHz mono source and correct final conversion to LiveKit expected format (resampling only once).
- Compare first playable audio and final playback, stalls, pronunciation and clarity. A vendor's H100 TTFA is not a benchmark for an L4.

## Translation Lab operator flow
1. Choose consented recording by ID; record SHA-256 and original language.
2. Choose `MT only` to isolate translation, select target language and eligible providers; provide human corrected source transcript.
3. Run, preserving model order/revisions and stage timings; blind reviewer identity.
4. Choose `TTS only` and identical target text for each provider.
5. Run full system with real-time paced audio; note source phrase duration, overlap and queue. No offline shortcuts.
6. Export evaluation results, signoff decision and warnings. Do not modify live production default.

## Failure drills
- Kill GPU worker mid-segment: active meeting remains connected; pending translation shows failure and original evidence remains.
- Revoke consent: worker stream cancelled, client playback stops, original recording handling follows policy.
- Unsupported language: dropdown disallows and API rejects with typed error.
- GPU OOM: bounded queue and error; service restarts with backoff, alert emitted.
- Network disconnect: no duplicate completed delivery or misordered voice.
- Switch engines: new segments only; old audio retains provenance.
- Loss of voice worker: captions survive and next segment can be explicitly run on Sarvam.

## Production release gates
- Code review + tests + metrics and fluent-listener report.
- Worker endpoint private/authenticated and egress controlled.
- Regression: room join, six-seat constraints, independent tracks, original replay, language fanout, consent, report evidence, error and reconnect.
- Rollback: disable feature flags, verify public Sarvam path and cleanly shut down experimental GPU.
- Add actual tested SHA/configuration and incidents to `PROJECT_SUMMARY.md`.

## Cost and timing reporting
For each run record: total GPU uptime; idle vs active inference time; model load/cold-start; audio minutes processed; successful outputs; cost at actual invoice rate; region RTT; p50/p95 end-of-phrase→first and last audible translation; errors; and speaker/listener count. Do not claim a real-time SLA based solely on short batch benchmarks.
