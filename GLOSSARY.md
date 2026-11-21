# Sahva Ubiquitous Language

Use these words consistently in UI, APIs, schemas, tests and tickets. Change terms here and record an ADR if meaning changes.

| Term | Definition | Not this |
|---|---|---|
| Room | Time-bound shared audio conversation session joined through an invitation | A PSTN phone call |
| Participant | Authorized person in a room with name and preferred listening language | A permanently registered account |
| Preferred listening language | Language in which another's speech is translated, played and meeting outcomes displayed | Assumption about nationality |
| Turn / Utterance | One participant's bounded, explicit recording, maximum 25 seconds in P0 | A continuously open microphone stream |
| Original audio | The source speaker's uploaded voice file, preserved as heard | AI-transformed or cloned audio |
| Source transcript | STT interpretation of original audio; may be erroneous | Ground truth |
| Transcript revision | A user-reviewed correction linked to a source transcript, with author/time | Replacement of original audio |
| Translation | Text rendering of an utterance into a participant's listening language | A factual verification of the statement |
| Translated audio | TTS output of a translation, attributed to an AI voice | The original speaker's real voice |
| Delivery | One translated text/audio rendering for one target language, shared by recipients of that language | A one-to-one human message |
| Conversation timeline | Time-ordered turns with original and translated audio / optional captions | A plain chat app |
| Meeting glossary | Approved spelling/pronunciation/meaning of specialist terms for a room | Full transcript or unconstrained LLM memory |
| Meeting record | Language-neutral structured decisions, proposed actions, unresolved questions with evidence | One-language prose summary |
| Localized report | Preferred-language view of the same meeting record | Independent generation of different meeting facts |
| Commitment | An explicit promise or agreement attributable to a participant | AI-suggested to-do |
| Proposed action | An action mentioned but not explicitly accepted | Confirmed commitment |
| Evidence | Room turn ID(s) and transcript span/quote that support a claim | LLM confidence alone |
| Confirmation | Participant review of an extracted item | Silent LLM inference |
| Room owner | Person who creates room and can end/delete it | Legal controller of everyone else's data |
| P0 | End-to-end one-day must-have with testable acceptance | Aspirational production SaaS |
