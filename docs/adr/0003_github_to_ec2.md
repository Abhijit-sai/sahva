# ADR-0003 — GitHub releases deploy to an existing EC2 instance

**Accepted on 2026-11-21.** The user selected their GitHub repository and an existing EC2 instance for the buildathon.

GitHub Actions tests main, builds a Linux x86-64 image containing Next.js and FFmpeg, and publishes an image archive and checksum under the commit SHA. An EC2 systemd timer pulls successful releases over HTTPS. A candidate must reach database readiness before the installer swaps the app container. The previous release can be selected by commit. This keeps operating credentials on EC2 and works without issuing an AWS deployment key to GitHub.

The runtime uses the existing Supabase project for PostgreSQL and private media. Server-side SQL uses DATABASE_URL and the storage SDK uses the project secret. Explicit local development mode uses embedded PostgreSQL (PGlite) and private files for offline room and privacy checks. The production runtime rejects that mode. FFmpeg measures duration from decoded samples, including seekable phone MP4s and browser WebM.

The running EC2 image and public readiness endpoint are separate release gates from CI. The first host must have the supported architecture, free app port, adequate disk, a trusted HTTPS endpoint, and the runtime environment file. Host installation, rollback and current evidence live in [the deployment runbook](../../ops/AWS_DEPLOYMENT.md) and [the phase ledger](../../PROJECT_SUMMARY.md).
