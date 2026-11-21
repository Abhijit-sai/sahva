# Environment Setup and Deployment Runbook

**No secrets or credentials are included. No project/repo/deployment has been created or tested in this pack.**

## Prerequisites
- Node.js current supported LTS, npm/pnpm chosen consistently; Git.
- Next.js project and a Supabase project configured by the developer.
- Sarvam account, valid key, tested service quota and accepted processing terms.
- OpenAI or other schema-capable LLM key for summary (choose one and document adapter).
- HTTPS hosting with enough request lifetime or an explicit worker/queue for multi-stage processing.
- Two distinct browsers/devices and headphones.

## Proposed environment variable template
```env
# SERVER ONLY — never prefix with NEXT_PUBLIC_
SARVAM_API_KEY=
OPENAI_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SAHVA_SESSION_SIGNING_KEY=

# Depending on selected Supabase SDK/server architecture
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-side base URL, no secret
SAHVA_BASE_URL=http://localhost:3000
SAHVA_AUDIO_MAX_SECONDS=25
SAHVA_ROOM_MAX_PARTICIPANTS=2
```

Do not commit `.env.local`, actual invite tokens, provider outputs containing personal data or generated audio into a public repo. Add sample `.env.example` without values. Never reveal service-role key to client.

## Suggested clean-repo bootstrap commands (not executed)
```bash
npx create-next-app@latest sahva --typescript --eslint --tailwind --app
cd sahva
npm install @supabase/supabase-js zod
# Optionally install shadcn/ui after core pipeline works
```

Other dependencies and exact versions should be chosen when the live repo is inspected, not frozen here sight-unseen. Match CI/runtime constraints and record versions in lockfile.

## Deployment sequence
1. Create Supabase database tables with actual versioned SQL migrations; private storage buckets.
2. Implement and verify room auth, scoped signed media URL access, and secret isolation.
3. Confirm hosting server runtime supports upload size and job processing. Stage async work via a supported worker, not `void process()` in serverless.
4. Deploy HTTPS first; test browser mic permissions and auto-play behavior on deployed origin.
5. Use two devices on separate sessions. Confirm actual two-way speech and report evidence with fresh input.
6. Restrict usage to authorized demo testers; monitor costs and rate limits.
7. After demo, execute confirmed retention/deletion procedure; record actual outcome.

## Before any provider implementation
Run the smoke tests documented in `docs/05_TECH_STACK_AND_PROVIDERS.md`. Record outputs in `PROJECT_SUMMARY.md` without copying voice/transcripts containing personal information. Capture only safe request IDs, status, latency, recognized language and test annotations.

## Production caveats
This 12-hour implementation is not a regulated communication platform. Before production: legal/privacy review, user identity and organization access controls, background processing reliability, abuse prevention, retention automation, full monitoring, data deletion rights, provider terms, encryption keys, backup and disaster recovery, and explicit user verification of commitments.
