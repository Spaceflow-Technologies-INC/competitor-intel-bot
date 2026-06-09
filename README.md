# Competitor Intel Bot

Internal Spaceflow Slack bot for competitor intelligence in procurement AI, sourcing automation, supplier intelligence, and adjacent workflow-agent markets.

The bot is built as a small TypeScript service that can run on Google Cloud Run. It stores a competitor graph in Postgres, extracts deterministic source-backed signals, scores them, and renders Slack alerts and digests.

## What it does

- Tracks seed competitors from `COMPETITOR_SEEDS`.
- Creates a source graph for each competitor: homepage, blog, pricing, and careers.
- Normalizes fetched source snapshots into stable hashes.
- Extracts deterministic intel signals such as product launches, customer wins, pricing changes, integrations, funding, and hiring signals.
- Scores every signal across relevance, novelty, confidence, and impact.
- Scores source quality so official, trusted, general, and weak sources read differently.
- Deduplicates repeat signals and merges new source URLs into the existing signal.
- Renders high-signal Slack alerts and daily digest messages.
- Lets leaders manage monitoring, approvals, battlecards, discovery, and digest timing from Slack with `/competitor` commands.
- Exposes Cloud Scheduler friendly job endpoints.

## Architecture

```text
Cloud Scheduler
  -> Cloud Run HTTP service
    -> Postgres competitor graph
    -> source normalization
    -> deterministic signal extraction
    -> signal scoring
    -> Slack channel alerts/digests
```

The current implementation is public-source first. Paid discovery APIs and LLM summarization are optional env-backed extensions, not required for the service to boot.

## Local setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run build
npm start
```

Health check:

```bash
curl http://localhost:8080/ping
```

Job endpoints:

```bash
curl -X POST http://localhost:8080/jobs/collect
curl -X POST http://localhost:8080/jobs/daily-digest
curl -X POST http://localhost:8080/jobs/scheduled-digest
```

`/jobs/collect` searches Parallel Web, extracts source content, scores signals, and stores new high-signal intel without posting to Slack. `/jobs/daily-digest` runs a fresh collection pass, posts the morning Slack digest, then marks posted signals so duplicates are not sent again. `/jobs/scheduled-digest` checks the Slack-configured digest time first, then calls the daily digest only when the current `Europe/Istanbul` time matches.

## Slack app setup

Create the Slack app from the repository manifest.

1. Open [Slack API apps](https://api.slack.com/apps).
2. Click **Create New App**.
3. Select **From an app manifest**.
4. Choose the workspace.
5. Paste `slack/app-manifest.yml`.
6. Review and create the app.
7. Install the app to the workspace.
8. Copy the bot token into `SLACK_BOT_TOKEN`.
9. Copy **Basic Information → App Credentials → Signing Secret** into `SLACK_SIGNING_SECRET`.
10. Invite the bot to the target channel:

```text
/invite @Competitor Intel Bot
```

The manifest enables:

- `chat:write` for channel reports.
- `commands` for the `/competitor` slash command.
- Interactivity for action buttons in command responses.

Slack request URLs:

```text
Slash command: https://competitor-intel-slack-vsfr73ns4a-ew.a.run.app/slack/commands
Interactivity:  https://competitor-intel-slack-vsfr73ns4a-ew.a.run.app/slack/interactions
```

### Slack commands

```text
/competitor help
/competitor list
/competitor list all
/competitor add "Acme Sourcing"
/competitor add https://www.linkedin.com/company/acme-sourcing/
/competitor add coupa.com Coupa procurement_ai
/competitor add "SAP Ariba" ariba.com erp_procurement
/competitor suggest newco.ai "NewCo AI" sourcing_automation
/competitor approve newco.ai
/competitor reject newco.ai
/competitor show coupa.com
/competitor schedule
/competitor schedule 08:30
/competitor archive coupa.com
/competitor delete coupa.com
/competitor run now
```

`add` accepts the domain and name in either order. Category defaults to `procurement_ai` when omitted.

If `add` receives only a company name, or a profile URL such as LinkedIn, the bot uses Parallel Web discovery to find the official website and creates a candidate instead of approving it directly. The candidate is posted with Approve, Reject, Show profile, and Delete buttons.

`suggest` creates a candidate competitor and posts approval buttons. `approve` moves it into active monitoring. `reject` keeps the audit trail but excludes it from scans.

`show` renders a Slack battlecard with profile fields, best source quality, recent signals, suggested next move, and source links.

`schedule` shows or changes the daily digest time in `Europe/Istanbul`. The scheduler checks every minute, so any valid `HH:mm` can be used without code changes.

`archive` is a soft delete: the competitor is excluded from future scans, but historical signals stay in Postgres.

`delete` fully removes the competitor and its source graph. Historical signals remain in the archive with the competitor link detached.

Supported categories:

- `procurement_ai`
- `sourcing_automation`
- `supplier_intelligence`
- `erp_procurement`
- `workflow_agent`
- `adjacent`

The bot should be deployed as two Cloud Run services:

- `competitor-intel-bot`: private worker service for Cloud Scheduler. `ENABLE_JOB_ENDPOINTS=true`.
- `competitor-intel-slack`: public Slack control service. `ENABLE_JOB_ENDPOINTS=false`, `REQUIRE_SLACK_SIGNATURE=true`.

The public Slack service rejects all Slack requests unless a valid Slack signing secret is configured.

Add or rotate the Slack signing secret with an interactive shell prompt:

```bash
read -r -s SLACK_SIGNING_SECRET
echo
test -n "$SLACK_SIGNING_SECRET" || { echo "Signing secret is empty"; exit 1; }

if gcloud secrets describe competitor-intel-slack-signing-secret --project polar-land-465511-j7 >/dev/null 2>&1; then
  printf "%s" "$SLACK_SIGNING_SECRET" | gcloud secrets versions add competitor-intel-slack-signing-secret --project polar-land-465511-j7 --data-file=-
else
  printf "%s" "$SLACK_SIGNING_SECRET" | gcloud secrets create competitor-intel-slack-signing-secret --project polar-land-465511-j7 --data-file=-
fi

gcloud run services update competitor-intel-slack \
  --project polar-land-465511-j7 \
  --region europe-west1 \
  --update-secrets SLACK_SIGNING_SECRET=competitor-intel-slack-signing-secret:latest
```

## Required environment

| Variable | Purpose |
| --- | --- |
| `SLACK_BOT_TOKEN` | Slack bot token with `chat:write`. |
| `SLACK_CHANNEL_ID` | Slack channel that receives intel. |
| `DATABASE_URL` | Postgres connection string. |
| `COMPETITOR_SEEDS` | Semicolon-separated seed list: `Name\|url\|category`. |

Optional:

| Variable | Purpose |
| --- | --- |
| `PARALLEL_API_KEY` | Parallel Web API key for search and page extraction. |
| `OPENAI_API_KEY` | Reserved for LLM summarization. |
| `OPENAI_MODEL` | Optional model name for summarization extensions. Defaults to `gpt-5.4-mini`. |
| `ALERT_SCORE_THRESHOLD` | Default `0.75`. |
| `SLACK_SIGNING_SECRET` | Required for public Slack command/interactivity endpoints. |
| `ENABLE_JOB_ENDPOINTS` | Set `true` for the private scheduler service and `false` for the public Slack service. |
| `REQUIRE_SLACK_SIGNATURE` | Set `true` for the public Slack service. |

Supported seed categories:

- `procurement_ai`
- `sourcing_automation`
- `supplier_intelligence`
- `erp_procurement`
- `workflow_agent`
- `adjacent`

## Cloud Run deployment shape

Create a Cloud SQL Postgres database, store secrets in Secret Manager, then deploy the image to Cloud Run. Cloud Scheduler should call:

- `POST /jobs/collect`
- `POST /jobs/scheduled-digest`

Recommended production schedule:

- `competitor-intel-collect`: `0 8 * * *` in `Europe/Istanbul`
- `competitor-intel-daily-digest`: `* * * * *` in `Europe/Istanbul`

`competitor-intel-daily-digest` intentionally runs every minute. The app stores the real digest time in Postgres through `/competitor schedule HH:mm` and only posts when the stored time matches. The default stored time is `09:00`.

The service listens on `PORT`, defaulting to `8080`.

Example private worker deploy shape:

```bash
gcloud run deploy competitor-intel-bot \
  --source . \
  --region europe-west1 \
  --no-allow-unauthenticated \
  --set-env-vars PORT=8080,ENABLE_JOB_ENDPOINTS=true
```

Example public Slack service deploy shape:

```bash
gcloud run deploy competitor-intel-slack \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars PORT=8080,ENABLE_JOB_ENDPOINTS=false,REQUIRE_SLACK_SIGNATURE=true
```

For production, prefer authenticated Scheduler requests and Secret Manager mounted env vars.

## Development

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## License

MIT
