# Coding Standards and Review Policy

## Structural standards
- TypeScript `strict` enabled; no `any` in domain/public APIs without reason and test.
- Prefer domain modules with narrow interfaces and explicit high-level tests over a large number of thin wrappers.
- Keep ASR/translation/TTS/LLM transport details inside provider adapters. Domain code accepts typed results only.
- No business logic embedded inside React event handlers; UI calls application service.
- Use Zod or equivalent on HTTP input, model output and provider response. Defensive server-side checks mandatory.
- Use database constraints for concurrency/idempotency and unique item identity, not only application flags.
- Limit room lifetime, participant count, file duration/size and retries.
- Prefer actual error states over dummy or fabricated success paths.

## Test guidelines
- Add a failing test for each critical invariant first where practical: `no consent -> no record`, `unknown evidence -> invalid report`, `same canonical item IDs across languages`, `duplicate idempotency -> one turn`.
- Mock at provider boundaries. Add a small real provider smoke script, not hidden dependencies in unit tests.
- E2E test paths: create→join→upload→process→deliver and end→report→localize.
- Run lint, typecheck and focused tests for each ticket. Document exact commands/results.

## Review axes (adapted from public Matt Pocock workflow)
1. **Spec axis:** Does observable behavior match PRD, acceptance and user journey? Are limitations explicitly reported?
2. **Standards axis:** Safe authorization/storage, typed contracts, failure/retry states, simple architecture, no accidental secret exposure, tests and clean diff?

## No accidental context loss
- Fresh agents read `agent/STARTUP_PROMPT_TEMPLATE.md` and newest project summary entry before changing code.
- Logs belong in append-only `PROJECT_SUMMARY.md`; accepted decisions in ADRs; API contracts in `docs/07_API_AND_EVENT_CONTRACTS.md`; never make every phase summary a second PRD.
- Keep generated code/demo claims separately from verified test evidence.


## Experimental inference

Pin checkpoint and runtime dependencies, test the worker contract independently of real-model quality, validate language direction and length on both sides, and preserve bounded deadlines and concurrency through cancellation. Link retries to their fixture and record each attempt. Keep human audio, full captions and tokens out of source control and logs.
