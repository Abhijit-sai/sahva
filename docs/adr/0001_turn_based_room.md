# ADR-0001 — Turn-based room before full-duplex calling

**Date:** 2026-11-21  
**Status:** PROPOSED / accepted for initial planning, to confirm when implementation begins  
**Context:** Buildathon requires an end-to-end voice and AI user outcome in ~12 hours. Open microphones, original/translated audio routing, barge-in and echo suppression are high-risk.

## Decision
P0 uses a two-person browser room with presence, explicit 25-second utterance recordings, backend processing, original and translated replay, and a live-updating timeline. Polling is acceptable for room updates. **Do not call it continuous simultaneous voice translation**. A LiveKit full-duplex audio track architecture is deferred until the translation pipeline and UX are proven.

## Alternatives
1. LiveKit open microphone, live audio translated to recipient: more immersive but risks echo/overlap, costly integration and uncertain latency.
2. Telegram voice-message bot: easiest fallback, but less memorable custom UI.
3. WhatsApp group bot: setup/API restrictions risk buildathon.

## Consequences
+ Highest chance of complete product with two users and testable evidence.  
+ Source audio is naturally attributed by explicit turn.  
− Not an uninterrupted natural phone call.  
− Conversation has deliberate processing pauses; UI must communicate this honestly.

**Review trigger:** Bidirectional turn demo and deployed room stable; then evaluate LiveKit/Realtimes P2 with actual audio routing tests.
