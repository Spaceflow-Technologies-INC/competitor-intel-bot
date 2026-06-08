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
| `SEARCH_API_KEY` | Reserved for search/news discovery. |
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
