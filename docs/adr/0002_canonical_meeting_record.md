# ADR-0002 — One canonical meeting record, many localized views

**Date:** 2026-11-21  
**Status:** PROPOSED / accepted for initial planning, to confirm when implementation begins  
**Context:** Generating a standalone meeting summary independently in English and Telugu can produce conflicting decisions, owners and deadlines, especially when source speech is uncertain.

## Decision
Build a structured, language-neutral `MeetingRecord` containing stable IDs, facts, certainty/status, evidenceTurnIds, owner identifiers and date fields. Translate **only human-language display strings** for each user's preferred language. Localizations must preserve canonical IDs/statuses/owners/dates/evidence exactly.

## Alternatives
1. Two separate LLM summaries: simpler prompts but divergences possible.
2. One English summary + full-text translation: may bury evidence/status in prose.

## Consequences
+ Both listeners see one shared understanding; source evidence is traceable.  
+ Allows review, correction and future task/calendar integrations.  
− Requires schema, validation and item-level localization mappings.  
− Extraction is still probabilistic; uncertain items need human confirmation rather than invented certainty.

**Review trigger:** A real bilingual report where an action/owner/date is mishandled; improve validation, not generate unrelated second truth.
