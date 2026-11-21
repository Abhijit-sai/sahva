# Run Sahva locally

Use Node 24, npm, Chrome and FFmpeg on PATH. From the repository directory run `npm ci`. Copy `.env.example` to `.env.local` if the latter does not exist. Set the server keys there. For two local browser profiles with private on-disk data, start PowerShell with:

```powershell
$env:SAHVA_LOCAL = '1'
npm run dev -- --hostname 127.0.0.1 --port 3018
```

Open http://127.0.0.1:3018 in Chrome, create a room, and open its invitation in an incognito profile. Each profile chooses speaking/listening preferences and explicitly consents. The private local database and recordings are in .sahva/dev. Provider calls are real when the keys are configured. Missing credentials produce visible stage failures. Production requires Supabase.

## Tests

```powershell
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run build
```

The default browser suite starts its own server on 127.0.0.1:3231 and uses isolated development data, a synthetic Chrome microphone and deliberately offline speech. The live speech smoke checks local formats first and requires consent before upload.

```powershell
npm run smoke:speech -- --check-only --telugu "path/to/telugu.mp4" --english "path/to/english.mp4"
npm run smoke:speech -- --consented --telugu "path/to/telugu.mp4" --english "path/to/english.mp4"
node --env-file=.env.local scripts/report-smoke.ts
```

WAV, WebM, Ogg, MP4 and M4A audio are accepted. Private transcripts, provider WAVs and a redacted receipt live under .sahva/speech-*. The report-only smoke uses synthetic text.

The optional full live browser test expects four consented MP4 samples in .sahva/clips named English 1.m4a.mp4, English 2.m4a.mp4, Telugu 1.m4a.mp4, and Telugu 2.m4a.mp4. It uses the actual app APIs, Sarvam and OpenAI. To run once from PowerShell, set `$env:SAHVA_LIVE_QA='1'`, run `npm run test:browser`, and then `Remove-Item Env:SAHVA_LIVE_QA`. The browser suite uses isolated local persistence. The separate real-device demo must use fresh microphone turns.

## Hosted data

Use the Project URL, server Secret key, PostgreSQL database URI and runtime keys described in [the AWS deployment runbook](AWS_DEPLOYMENT.md). Run `node --env-file=.env.local scripts/setup-supabase.ts` against the intended project. It verifies project binding, private buckets, migration checksums and table names. The cloud host uses the same script on deployment.
