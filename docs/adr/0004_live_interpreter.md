# ADR-0004 — Live captions and phrase interpretation

**Accepted 2026-11-21** for the local two-person demonstration. The user expanded the initial recorded-turn scope to live transcription and translation. ADR-0001 remains applicable to saved voice turns. ADR-0002 still governs meeting outcomes.

## Decision

Add an explicit **Speak live** mode to the same authenticated room. One participant holds the existing recording lease. A browser AudioWorklet sends sequenced 200 ms mono PCM frames over same-origin HTTP. A single Node process keeps a short-lived server-side Sarvam WebSocket for that phrase. Both participants receive revisable source captions through the timeline. Rate-limited draft translations use Mayura. A pause finalizes the source text. The server saves the actual captured PCM as a private WAV and binds the final transcript to the same attributed turn. A manual finish or an interrupted provider stream falls back to the existing file transcription path. Translated voice and meeting outcomes consume only durable turns. Incoming voice is opt-in and ordered.

The ephemeral stream requires a single long-running application process. Frame ordering, recording leases, room-scoped cookies, byte limits and session timeouts apply. Consent withdrawal, ending the room and leaving the capture UI stop streaming. An abandoned incomplete phrase can expire without an archived turn. The manual record/preview/submit path remains available. The live speaker explicitly selects their source language, and the listener's preference selects the translation target.

## Why this transport

LiveKit can carry full-duplex WebRTC audio and data. Sarvam provides recognition, translation and synthesis. This slice reuses the existing two-participant room, authorization, private audio and evidence model. Adding an SFU now would introduce another service without improving the measured model latency. Reconsider LiveKit for continuous remote original audio, overlapping speakers, packet loss handling, barge-in or multiple application replicas. That phase needs a two-device audio-routing prototype before selecting transport.

## Acceptance and limits

**LIVE-02 addition, 2026-11-21.** Participants can arm the microphone once and hold it locally between phrases. Short PCM energy windows trigger the existing room lease and preserve up to 600 ms of onset audio. Silence alone opens no provider session. Ordinary playback blocks new capture to limit echo. A headphone user can explicitly enable speech interruption, which stops synthesized playback locally and requests the same exclusive phrase lease. This applies to incoming translated playback, while simultaneous live speakers still share one lease. Mute releases the device. Disconnect and consent loss require a new user activation. This extension uses the same single-process relay and adds no persistent entity or room credential.

A second browser must see actual interim source captions and a clearly marked draft translation before the archive turn is ready. A pause should end the phrase without a Submit click. With incoming voice enabled, the other browser must play the generated voice, preserve original replay and show the same underlying bilingual report. Test both Telugu and English. A desktop microphone fixture does not establish natural pause quality, acoustic echo behavior, mobile compatibility or regional latency. Evaluate these on physical devices. [Sarvam realtime STT contract](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming)
