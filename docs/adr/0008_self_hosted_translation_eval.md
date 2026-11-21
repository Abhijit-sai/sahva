# ADR-0008 · Isolate self-hosted translation for evaluation

Proposed, 21 November 2026. ADR-0005 governs deployed meetings. ADR-0007 governs the local provider lab. The research pack’s proposed number 0006 is already assigned to Gemini.

Compare Mayura and the two directional distilled IndicTrans2 checkpoints on the same speaker-confirmed source text. Record source PCM hash, reference revision, actual output, model revision, elapsed time, failures and independent bilingual adjudication. Keep ASR and voice fixed for any subsequent complete-pipeline comparison. A worker accepts finalized text through an authenticated server connection. Original audio stays in the existing private evidence store.

Start with batch size one, one job in flight and no waiting queue. Measure throughput, warm and cold latency, peak memory, errors and cost per successful minute before changing capacity. Gate the internal preset on real authenticated direction-specific output. Gate a room trial on comparable meaning, critical-error rates, playback delay, reliability, permitted use and cost. A release needs room regressions and explicit approval.

Maya voice evaluation follows a meaningful MT result. ASR work requires baseline error attribution. Bodhan and direct speech translation require checkpoint-specific language and license evidence. The initial experiment uses preset voices.
