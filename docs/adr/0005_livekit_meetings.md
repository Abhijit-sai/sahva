# ADR-0005 · LiveKit group meetings

Accepted for STREAM-01 on 21 November 2026. The public two-person room remains available. A server-controlled meeting option creates rooms for up to six participants. Membership and consent are authenticated in Sahva. Each participant publishes one microphone to a room-scoped LiveKit session. Only the server interpreter subscribes to raw microphone tracks. Withdrawing consent invalidates the media session for everyone.

Each speaker has independent capture and transcription. The two supported languages allow one source and one translated delivery per utterance. Each listener receives the matching caption and recording. The timeline identifies draft and final states by a shared phrase identifier. Original audio, corrections and final text retain the existing report evidence model. Translated playback starts on finalized segments. New meeting rooms use the existing single-process runtime for the interpreter.
