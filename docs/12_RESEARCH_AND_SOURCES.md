# Research and Verification Notes

**Verified against public vendor documentation on 2026-11-21.** Documentation pages can change; API details should be retested with real account credentials. This file is research context, not implementation evidence.

## Matt Pocock workflow
- Official repo: https://github.com/mattpocock/skills
- Public workflow: `grill-with-docs` → `to-spec` → `to-tickets` → `implement` → `code-review` → `retro`, plus a shared domain glossary and ADRs.
- Official `/to-tickets` description: https://www.aihero.dev/skills-to-tickets — vertical tracer bullets with blockers, each independently demoable.
- Install option as of public README: for Codex, `codex plugin marketplace add mattpocock/skills` then `codex plugin add mattpocock-skills@mattpocock`; for Claude Code, `claude plugin install mattpocock-skills@claude-plugins-official`; for other agents `npx skills@latest add mattpocock/skills -a <agent>` and `/setup-matt-pocock-skills` once per repo.
- **We have not executed those skills in any user's local repo.** This documentation pack adapts the method and remains usable without them.

## Provider grounding
- Sarvam model overview: https://docs.sarvam.ai/api/getting-started/models
- STT overview: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview
- STT REST, <=30 seconds: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api
- Keyterms on Saaras v4: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/how-to/keyterms
- Mayura v1 translation: https://docs.sarvam.ai/api/api-guides-tutorials/models/mayura
- Translate endpoint, model/language limits: https://docs.sarvam.ai/api-reference/text/translate-text
- TTS Bulbul v4 Flash: https://docs.sarvam.ai/api/api-guides-tutorials/models/bulbul
- TTS REST requests and base64 audio responses: https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/rest-api
- LiveKit room React component, possible later full-duplex calling layer: https://docs.livekit.io/reference/components/react/component/livekitroom/

## Choices requiring measurement
1. Telugu input quality on noisy and code-mixed audio.
2. Availability and acceptable speaker IDs for English and Telugu.
3. Time and cost per 10-second turn of STT+translation+TTS.
4. End-to-end processing in intended deployment server/worker limits.
5. Whether translated audio plays reliably after user gesture on target browsers.
6. In practice, accuracy of conservative action extraction for culturally specific phrases.
7. Current price/quotas, rate limits, service data handling and terms.

## Important distinction
The provider API documentation verifies *capability and request contracts*, not that Sahva has already been implemented, tested, benchmarked or deployed. All phase reports begin at NOT STARTED until verified in the live repository.


## Self-hosted sources checked 21 November 2026

Hub metadata identifies both gated MIT checkpoints. Toolkit dependencies and laptop or vendor examples establish no Sahva performance result. [English to Indic](https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M) · [Indic to English](https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M) · [Toolkit](https://github.com/VarunGumma/IndicTransToolkit) · [EC2 specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html)
