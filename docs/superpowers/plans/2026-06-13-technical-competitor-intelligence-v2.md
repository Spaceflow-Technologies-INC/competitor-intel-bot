# Technical Competitor Intelligence V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Slack competitor bot from market-signal logging into an evidence-backed technical competitor analyst with onboarding, technical briefs, source graphs, comparison, and unknown tracking.

**Architecture:** Keep the existing Fastify + Slack command shape. Add focused technical-intel modules for onboarding config, source graph planning, evidence extraction, brief synthesis, Slack rendering, and storage. Store evidence and generated briefs in Postgres tables with MemoryStore parity; use deterministic synthesis in tests and optionally OpenAI/Parallel in production.

**Tech Stack:** TypeScript, Fastify, Slack Block Kit JSON, Postgres, Parallel Web search/extract, OpenAI Responses API, Vitest.

---

### Task 1: Evidence, Brief, and Onboarding Storage

**Files:**
- Modify: `src/types.ts`
- Modify: `src/storage/memory-store.ts`
- Modify: `src/storage/postgres-store.ts`
- Modify: `src/storage/postgres-mappers.ts`
- Test: `test/storage/memory-store.test.ts`

- [ ] Write failing tests for saving onboarding config, evidence items, and technical briefs.
- [ ] Add technical-intel types: source kind, evidence stance, evidence item, technical brief, onboarding config.
- [ ] Add Store methods: `getIntelConfig`, `saveIntelConfig`, `recordEvidenceItems`, `listEvidenceForCompetitor`, `saveTechnicalBrief`, `getLatestTechnicalBrief`.
- [ ] Implement MemoryStore parity.
- [ ] Add Postgres migrations/tables and row mappers.
- [ ] Run targeted storage tests until green.

### Task 2: Technical Source Graph

**Files:**
- Create: `src/technical/source-graph.ts`
- Test: `test/technical/source-graph.test.ts`

- [ ] Write failing tests for light, standard, and deep source graph plans.
- [ ] Build source plans for homepage, product, pricing, docs, API docs, changelog, integrations, security, careers, reviews, social, technographics, webinars, and news.
- [ ] Include procurement-specific search queries for AI usage, workflow pipeline, integrations, governance, supplier/RFQ/PO modules.
- [ ] Run targeted source graph tests until green.

### Task 3: Technical Evidence Extractor and Brief Synthesizer

**Files:**
- Create: `src/technical/evidence.ts`
- Create: `src/technical/brief.ts`
- Create: `src/technical/openai-technical-brief.ts`
- Test: `test/technical/evidence.test.ts`
- Test: `test/technical/brief.test.ts`

- [ ] Write failing tests that classify evidence versus inference versus unknown.
- [ ] Extract product features, AI capabilities, pipeline steps, integrations, governance, moat, weakness, and Spaceflow counter-positioning from pages.
- [ ] Keep deterministic fallback output source-backed and stable.
- [ ] Add optional OpenAI synthesis with deterministic fallback and no failure propagation.
- [ ] Run targeted technical tests until green.

### Task 4: Technical Research Orchestrator

**Files:**
- Create: `src/technical/research.ts`
- Test: `test/technical/research.test.ts`

- [ ] Write failing tests for refresh behavior using a fake WebIntelClient.
- [ ] Search/extract pages from the technical source graph.
- [ ] Store evidence items and latest technical brief.
- [ ] Support cached latest brief when a refresh is not requested.
- [ ] Run targeted research tests until green.

### Task 5: Slack Onboarding, Brief, Sources, Compare, Evidence, Unknowns

**Files:**
- Create: `src/slack/technical-render.ts`
- Modify: `src/slack/control.ts`
- Test: `test/slack/control.test.ts`

- [ ] Write failing tests for `/competitor onboard`, `/competitor sources`, `/competitor tech`, `/competitor brief`, `/competitor refresh`, `/competitor compare`, `/competitor evidence`, and `/competitor unknowns`.
- [ ] Render compact Slack blocks with source links, evidence/inference labels, unknowns, and action buttons.
- [ ] Wire command handlers without growing `control.ts` beyond the project’s 300-line guideline.
- [ ] Run targeted Slack tests until green.

### Task 6: Server Wiring, Docs, and Verification

**Files:**
- Modify: `src/server.ts`
- Modify: `README.md`
- Modify: `slack/app-manifest.yml`
- Test: `test/server.test.ts`

- [ ] Wire production deps: Parallel client and optional OpenAI technical brief synthesizer.
- [ ] Update docs and manifest usage hints.
- [ ] Run full verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- [ ] Commit, push, open PR, wait for CI, merge, watch main deploy, verify Cloud Run services.
