# Competitor Intel Bot

Internal Spaceflow Slack bot for competitor intelligence in procurement AI, sourcing automation, supplier intelligence, and adjacent workflow-agent markets.

The bot is built as a small TypeScript service that can run on Google Cloud Run. It stores a competitor graph in Postgres, extracts deterministic source-backed signals, scores them, and renders Slack alerts and digests.

## What it does

- Tracks seed competitors from `COMPETITOR_SEEDS`.
- Creates a source graph for each competitor: homepage, blog, pricing, and careers.
- Normalizes fetched source snapshots into stable hashes.
- Extracts deterministic intel signals such as product launches, customer wins, pricing changes, integrations, funding, and hiring signals.
- Scores every signal across relevance, novelty, confidence, and impact.
- Renders high-signal Slack alerts and daily digest messages.
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
```

## Slack app setup

Create the Slack app from the repository manifest:

1. Open [Slack API apps](https://api.slack.com/apps).
2. Click **Create New App**.
3. Select **From an app manifest**.
4. Choose the workspace.
5. Paste `slack/app-manifest.yml`.
6. Review and create the app.
7. Install the app to the workspace.
8. Copy the bot token into `SLACK_BOT_TOKEN`.
9. Invite the bot to the target channel:

```text
/invite @Competitor Intel Bot
```

The manifest requests only `chat:write`, which lets the bot call `chat.postMessage`. For public channels, invite the bot to the channel before posting. If you want posting to public channels without inviting the bot, add Slack's optional `chat:write.public` bot scope and reinstall the app.

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
| `OPENAI_MODEL` | Optional model name for summarization extensions. |
| `ALERT_SCORE_THRESHOLD` | Default `0.75`. |

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
- `POST /jobs/daily-digest`

The service listens on `PORT`, defaulting to `8080`.

Example deploy shape:

```bash
gcloud run deploy competitor-intel-bot \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars PORT=8080
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
