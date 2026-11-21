# Deploy Sahva from GitHub to an existing EC2 instance

Use this runbook for the first installation, later patches and rollback. See PROJECT_SUMMARY.md for which steps have actually been verified. The source repository is [Abhijit-sai/sahva](https://github.com/Abhijit-sai/sahva).

## What happens after a push

1. GitHub Actions checks types, lint, unit tests, the offline two-browser flow and the Next.js production build.
2. For application changes on `main`, Actions builds a Linux x86-64 Docker image with FFmpeg, boots it, checks its HTTP health endpoint, and publishes the compressed image and SHA-256 checksum in a release named `build-<full-commit-sha>`.
3. The EC2 instance checks the latest release every two minutes. It verifies the download, applies versioned Supabase migrations, starts a candidate container, and checks database readiness before replacing the running application. It restores the previous container if the replacement fails its readiness check. The swap briefly interrupts requests. Avoid deploying during a demo conversation.
4. A green GitHub release means the image passed CI. Verify the running EC2 image and public HTTPS health separately. The integrated smoke tests requiring consented audio or paid APIs run outside public CI.

The instance pulls public build artifacts over HTTPS. GitHub requires no AWS credentials, instance SSH key or production provider secrets. [Release history](https://github.com/Abhijit-sai/sahva/releases) · [Workflow runs](https://github.com/Abhijit-sai/sahva/actions)

## First installation

### 1. Select the instance

In **AWS Console → EC2 → Instances**, select the existing Sahva instance in the intended region. Record its instance ID, public address, OS, architecture and available disk space in your private operator notes. Select **Connect → Session Manager → Connect** when available. The **EC2 Instance Connect** tab is another option on a configured instance. On a shared host, inspect current web services before choosing a port or proxy. [AWS connection options](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect.html)

```bash
uname -m
cat /etc/os-release
df -h /
sudo ss -lntp
```

The provided image targets `x86_64` Linux. Budget disk space for two uncompressed images and one compressed download. The app uses loopback port 3000. Use a dedicated free port or a separate instance if that port belongs to an existing application. Confirm that the workshop permits inbound HTTP/HTTPS and outbound GitHub, Supabase, Sarvam and OpenAI access.

### Provisioning a dedicated buildathon instance

When the intended region has no reusable instance, review the new on-demand charges with the account owner. For a single two-participant demo, select Amazon Linux 2023 **x86_64**, **t3.small** (2 vCPU, 2 GiB RAM) and one **20 GiB gp3** root volume encrypted with the default EBS key. Set the name to `sahva-demo`. The image is prebuilt on GitHub. Node.js serves the app and FFmpeg converts short recordings. Sarvam handles Telugu and English speech, OpenAI extracts outcomes and Supabase stores persistent data. Adding a supported language requires app and provider support, with no language package required on the host.

Enable a public IPv4 address. Allow TCP 443 to the demo audience and TCP 80 for certificate validation. Choose **My IP** for SSH. Use a dedicated ED25519 key pair and keep the downloaded private PEM in the operator's private files. Only the public key belongs on the instance. Confirm the target and network rules in the launch summary before clicking **Launch instance**. Wait for the instance status checks and verify the server's SSH host-key fingerprint against its EC2 system log before transferring settings.

The size is a starting point for one room. Verify capacity during the first real conversation and during a release swap when two containers overlap.

```bash
free -h
df -h /
sudo docker stats --no-stream
sudo docker system df
sudo journalctl -k -b --grep='Out of memory|Killed process'
```

Record the results and watch EC2 CPU credit balance during a longer demo. Keep space for the current image, rollback image and incoming archive. Budget separately for running time, IPv4 time, EBS storage, possible T3 surplus credits, outbound traffic and provider calls. Stopping the instance ends instance compute charges. Retained EBS volumes continue to accrue storage charges. A stop/start can release an automatically assigned public IPv4 address, requiring an updated URL and certificate for IP-based HTTPS. [AWS T3 instances](https://aws.amazon.com/ec2/instance-types/t3/) · [AWS instance stop behavior](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Stop_Start.html)

### 2. Install host tools and fetch the repository

On Amazon Linux 2023:

```bash
sudo dnf install -y docker git jq
sudo systemctl enable --now docker
```

On Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y docker.io git jq curl
sudo systemctl enable --now docker
```

Use a new location on first installation. The following commands assume the current user can use sudo.

```bash
sudo git clone https://github.com/Abhijit-sai/sahva.git /opt/sahva-source
cd /opt/sahva-source
sudo install -d -m 0700 /etc/sahva
sudo install -m 0755 ops/aws/update.sh /usr/local/sbin/sahva-update
sudo install -m 0644 ops/aws/sahva-update.service ops/aws/sahva-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

### 3. Set the runtime environment on EC2

Create `/etc/sahva/runtime.env` privately on the instance with root-only permissions. Enter one unquoted `NAME=value` per line. Using the SSH or Session Manager channel you control, set the following values from the Sahva project’s local settings. GitHub release contents are public.

| Name | Value |
| --- | --- |
| SARVAM_API_KEY | Active Sarvam subscription key |
| OPENAI_API_KEY | API key with structured-output model access |
| NEXT_PUBLIC_SUPABASE_URL | Sahva’s Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Project secret key or legacy service_role key |
| DATABASE_URL | PostgreSQL URI for the same project, with its password URL-encoded. Supabase **Connect → Session pooler** supports IPv4 |
| SAHVA_SESSION_SIGNING_KEY | Stable secret of at least 32 bytes. Rotating it invalidates current sessions |
| SAHVA_BASE_URL | The public HTTPS origin, with no trailing slash |

```bash
sudo touch /etc/sahva/runtime.env
sudo chmod 0600 /etc/sahva/runtime.env
sudoedit /etc/sahva/runtime.env
```

Use the runtime keys only. `SAHVA_LOCAL`, `SAHVA_TEST_RUN`, and `SAHVA_OFFLINE_TEST` are development controls. The publisher does not read your workstation's `.env.local`.

### 4. Deploy the first release

Check **GitHub → Actions → Test and publish Sahva** for a successful `publish` job and the matching **Releases** entry. Then run:

```bash
sudo /usr/local/sbin/sahva-update
curl -fsS http://127.0.0.1:3000/api/ready
sudo docker inspect -f '{{.Config.Image}}' sahva-app
sudo systemctl enable --now sahva-update.timer
systemctl list-timers sahva-update.timer
```

The updater creates or verifies both private buckets, verifies the database belongs to the configured project and applies additive SQL in one transaction. A checksum mismatch means a previously applied migration was edited. Add a new migration to change a deployed schema. The application schema lives in `sahva`; select that schema in the Supabase table editor. [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)

### 5. Enable HTTPS for microphones

Point the chosen domain’s DNS A record to the instance’s stable public IPv4 address. In **EC2 → Security groups**, allow the intended demo audience on TCP 443 and allow TCP 80 for certificate validation. The app container listens on loopback. If the instance has a web proxy, add a virtual host for Sahva pointing to `127.0.0.1:3000`. Preserve all existing sites.

On a **dedicated host with ports 80 and 443 free**, the supplied Caddyfile can run in Docker. Replace `voice.example.com` with the real DNS name, and use the same host in SAHVA_BASE_URL.

```bash
sudo docker run -d --name sahva-https --restart unless-stopped --network host \
  -e SAHVA_HOST=voice.example.com \
  -v /opt/sahva-source/ops/aws/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v sahva-caddy-data:/data -v sahva-caddy-config:/config caddy:2
curl -fsS https://voice.example.com/api/ready
```

Caddy obtains and renews the certificate for a public DNS name. If the workshop only gives you a public IP, a trusted IP certificate is another route with Certbot 5.4+ and a stable address. Configure that certificate and renewal on the existing HTTPS proxy before attempting the microphone demo. [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https) · [Let’s Encrypt IP certificates](https://letsencrypt.org/2026/03/11/shorter-certs-certbot)

### 6. Verify the actual deployment

Open the HTTPS site on two physical devices. Create and join a room, consent on both, speak two fresh turns per person, play original and synthetic audio, reload, correct one transcript and end the room. Check both report languages and evidence links. Record the release SHA, tests, public URL and limitations in PROJECT_SUMMARY.md. Human judges should confirm that names, quantities, commitments and tentative proposals survived translation. See docs/09_QA_AND_DEMO.md.

## Future patches

1. Inspect the current branch, status, upstream and both diffs. Preserve existing work.
2. On a clean checkout, fetch `origin`, create a patch branch from the intended base and implement the ticket. Append the dated phase evidence to PROJECT_SUMMARY.md.
3. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:browser` and `npm run build`. Chrome, FFmpeg and Node 24 are used locally. Hosted CI installs Chromium. Inspect staged files for credentials, local audio and private transcripts.
4. Commit, push the patch branch and merge its reviewed pull request to `main`. Changes affecting only Markdown do not publish an image. Use **Actions → Test and publish Sahva → Run workflow → main** for a deliberate rebuild.
5. Watch CI through release creation. After the next EC2 timer run, compare the running commit with GitHub and verify the public health and room flow.

```bash
sudo journalctl -u sahva-update.service -n 40 --no-pager
sudo docker inspect -f '{{.Config.Image}}' sahva-app
curl -fsS https://voice.example.com/api/ready
```

The updater itself is installed on the host. When a patch changes files in `ops/aws/`, inspect their diff, fast-forward the ops checkout, reinstall those files from the reviewed release, and reload systemd. The updater checks the runtime.env modification time. Saving the file triggers a health-checked replacement on the next timer run, including when the image SHA is unchanged.

## Rollback

Stop the timer to hold the selected version, then deploy the **full 40-character commit SHA** from a known-good release. Database changes must remain backward-compatible across a rollback.

```bash
sudo systemctl stop sahva-update.timer
sudo /usr/local/sbin/sahva-update PREVIOUS_FULL_COMMIT_SHA
curl -fsS http://127.0.0.1:3000/api/ready
```

After the fix is merged and released, run the updater without an argument, check public readiness, then start the timer. The updater leaves a prior container available after a successful swap. Inspect free disk after multiple releases and remove only unused Sahva images once the intended rollback versions are identified.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No release | Check GitHub Actions permissions, failing job output, main branch and docs-only filter. Ensure release creation is allowed by repository policy. |
| Database ENOTFOUND | Confirm the Session pooler URI for this project and test from EC2. A working Storage key does not verify PostgreSQL connectivity. |
| Storage works but tables appear missing | Select the sahva schema in Supabase and inspect migration output from the updater. |
| Browser cannot record | Open the browser-trusted HTTPS URL. Check microphone permission and both participants’ consent. |
| Release exists but app did not change | Inspect the timer, deployment journal, checksums, free disk, host architecture and /api/ready. |
| Provider stage fails | The saved original remains playable. Inspect the visible stage and safe error code, fix quota/key/connectivity and retry. |
| Report rejected | Review source transcripts and evidence. A generated item must satisfy the record validator. The timeline remains available for review. |

## Retention and operator deletion

Room access expires after 24 hours. Deletion is manual. For an authorized room deletion, verify its UUID and owner request. In Supabase Storage delete that room’s prefix from both private buckets, including older revision audio. Verify both prefixes are empty. Then delete only the matching row from sahva.rooms inside a transaction. Foreign keys cascade to participants, turns, revisions, deliveries and the meeting record. Verify these counts and record only the date and result in private operator notes. This procedure covers Sahva-managed data; external provider retention follows provider terms.

## Database TLS and region selection

The container includes the public Supabase production root in `supabase/prod-ca-2021.crt`. Both the migration client and the application use it to verify the PostgreSQL server and its hostname. For certificate rotation, verify the public certificate against the project’s Database Settings or the [official Supabase CLI production CA](https://github.com/supabase/cli/blob/develop/apps/cli/src/command-internal/supabase-ca-templates/prod-ca-2021.ts), then retest migrations and application readiness before rollout.

For the Oregon workshop deployment, select the specific Supabase region **West US (Oregon), us-west-2** so room queries and original/translated media stay near EC2. Supabase region changes require another project. Keep the previous project available through acceptance. Verify the new project URL, service key, pooler username and host belong together. Apply migrations, verify private buckets and use synthetic test audio for a two-way acceptance run before directing new rooms there. Existing room data and recordings require a separate scoped migration if they must remain accessible on the new deployment. [Supabase region migration](https://supabase.com/kb/troubleshooting/change-project-region-eWJo5Z)

Measure audio submission to playable translation for each direction from the chosen host. Record the three Sarvam stage times separately from database round trips and member playback. Use synthetic QA clips for server-side comparison. OpenAI runs on room end and can be timed independently.


## Optional isolated MT worker

On 21 November 2026 the workshop role showed 0 applied G/VT and P vCPUs for both On-Demand and Spot in Oregon and N. Virginia. Mumbai denied the quota lookup. Oregon has 256 Standard On-Demand vCPUs with six in use, a separate pool. DL/Inf/Trn allowances are for different accelerator runtimes. Check account, SKU, region, IAM, current price and quota again before allocation.

One Oregon g6.xlarge is a 4-vCPU, 24 GB L4 candidate. The AWS Linux shared On-Demand catalog listed $0.8048/hour. g5.xlarge (24 GB A10G) listed $1.006/hour and g6e.xlarge (48 GB L40S) $1.861/hour. Region-specific AZ capacity remains unknown. Seek approval for a maximum duration and all-in budget including EBS, transfer and any networking charges. Use a private subnet and authenticated tunnel. Run one worker, check both directions, collect nvidia-smi utilization/memory alongside timing and billed wall time. Set a session stop deadline before boot. End each test session by stopping the instance and verifying the EC2 state and billed uptime. Retain encrypted EBS for the next approved session. Final teardown and volume deletion require a separate retention decision. Roll back by deselecting the worker in the lab. [Oregon G quota](https://us-west-2.console.aws.amazon.com/servicequotas/home/services/ec2/quotas/L-DB2E81BA) · [AWS regional price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-west-2/index.csv)

For the translation-only pilot, the operator also identified g4dn.xlarge. AWS lists one NVIDIA T4 with 16 GiB GPU memory, 16 GiB host RAM and four vCPUs. The picker showed Linux at $0.526/hour. The Oregon catalog independently confirmed that compute rate (DY2XVQ4WPT7BKDCH.JRTCKXETXF.6YS6EN2CT7). This is a lower-cost first candidate for the two distilled MT checkpoints. Record warm latency, peak VRAM and concurrency on that device before deciding whether the larger L4 is worthwhile. Both sizes require four available On-Demand G/VT vCPUs. The picker does not establish account quota or available AZ capacity. [AWS hardware specifications](https://docs.aws.amazon.com/ec2/latest/instancetypes/ac.html)

The workshop organization policy denied the Oregon G/VT increase. The operator approved one Oregon `c7i.2xlarge` CPU session, up to two hours, at the observed Linux rate of $0.357/hour. This approval covers the initial test. For that session the operator authorized a temporary public IPv4 address and SSH from one operator IPv4 /32. Bind the worker to loopback, verify the SSH host key using the EC2 boot log, and tunnel the benchmark connection. Use encrypted gp3, IMDSv2 and guest shutdown behavior **Stop**. Enable the guest poweroff timer before installing packages, verify the timer is active, stop immediately after the tests, and verify EC2 shows **stopped**. The retained EBS volume incurs storage charges while stopped. The one-time trial details and results belong in the project ledger.

### Start and stop the experimental host

Record the approved instance ID, region, SKU and session end time. Check the host carries the experiment tag and an encrypted EBS root volume. Keep the pinned HF cache on EBS, since EC2 discards instance-store data on stop. Confirm guest-initiated shutdown behavior is set to Stop. At launch, configure a deadline that stops this specific instance even if the operator disconnects. Re-arm it for every approved start. There is no automatic wake schedule.

1. Verify the experiment host is stopped and the checkpoint cache and fixture references are ready. Start that ID only, wait for EC2 status checks, reopen the private tunnel, and check worker readiness in both directions.
2. Run the bounded batch, save its receipts and copy the permitted evidence. Stop as soon as the batch ends or fails. Send StopInstances for the tagged GPU instance and wait for instance-stopped. Stopping the worker container alone leaves EC2 compute billing active.
3. Record UTC start/stop, instance state and billable seconds. Retained EBS, snapshots and any allocated public IPv4 resources can still incur charges. A new start depends on capacity in the instance's Availability Zone. Start the same EBS-backed host for the next approved batch.

Use the following commands with the reviewed experiment ID and region from the session record. The start step incurs charges.

```bash
aws ec2 start-instances --region "$GPU_REGION" --instance-ids "$GPU_INSTANCE_ID"
aws ec2 wait instance-status-ok --region "$GPU_REGION" --instance-ids "$GPU_INSTANCE_ID"
# Complete the private benchmark and export evidence.
aws ec2 stop-instances --region "$GPU_REGION" --instance-ids "$GPU_INSTANCE_ID"
aws ec2 wait instance-stopped --region "$GPU_REGION" --instance-ids "$GPU_INSTANCE_ID"
```

[EC2 stop/start lifecycle](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Stop_Start.html)

For a three-language release rehearsal, confirm the active sahva-app image matches the intended release SHA and the public /api/ready endpoint succeeds. Run scripts/meeting-smoke.mjs with consented fictional English, Telugu and Hindi fixtures and --trilingual against the HTTPS origin. The normal rehearsal requires Tarun on both Telugu deliveries and browser playback on all six routes; the private Maya worker is optional. Preserve the actual voice name when comparing runs.
