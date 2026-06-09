# Competitor Intel Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable Spaceflow Competitor Intel Bot repository with typed config, Postgres-backed memory, deterministic signal scoring, Slack alerts/digests, seed competitor loading, and Cloud Run deployment docs.

**Architecture:** Create a separate TypeScript Node.js service at `/Users/orcunsahinoglu/Desktop/projects/competitor-intel-bot`. Keep modules small: config, storage, competitors, sources, signals, Slack, and HTTP server. The first version supports deterministic fixtures and manual/seed inputs so the service can run before paid search APIs are wired.

**Tech Stack:** Node.js 22, TypeScript, Vitest, ESLint, Fastify, `pg`, Slack Web API via `fetch`, Docker, Cloud Run, Cloud SQL Postgres.

---

## File Structure

Create a new git repository:

```text
/Users/orcunsahinoglu/Desktop/projects/competitor-intel-bot
```

Files:

```text
.dockerignore                         Docker build exclusions
.env.example                          Public env template
.github/workflows/ci.yml              CI for test/typecheck/lint/build
.gitignore                            Git exclusions
Dockerfile                            Cloud Run image
LICENSE                               MIT license
README.md                             Setup and operating guide
docker-compose.yml                    Local Postgres stack
eslint.config.js                      ESLint flat config
package.json                          Scripts and dependencies
package-lock.json                     Locked dependencies
tsconfig.json                         Typecheck config
tsconfig.build.json                   Build config
vitest.config.ts                      Vitest config

src/config.ts                         Env parsing
src/logger.ts                         Structured logger
src/server.ts                         Fastify HTTP server
src/types.ts                          Domain types
src/storage/postgres-store.ts         Postgres migrations and queries
src/storage/memory-store.ts           Test storage
src/storage/index.ts                  Store factory
src/competitors/seed.ts               Seed competitor parsing
src/competitors/service.ts            Competitor graph operations
src/sources/normalize.ts              Source snapshot normalization
src/signals/extract.ts                Deterministic signal extraction
src/signals/scoring.ts                Score calculation and alert threshold
src/slack/render.ts                   Slack message rendering
src/slack/client.ts                   Slack API wrapper
src/digests/daily.ts                  Daily digest selection/render input
src/jobs/run-collection.ts            Collection pipeline entrypoint
src/jobs/run-digest.ts                Digest pipeline entrypoint

test/config.test.ts
test/competitors/seed.test.ts
test/sources/normalize.test.ts
test/signals/extract.test.ts
test/signals/scoring.test.ts
test/slack/render.test.ts
test/storage/memory-store.test.ts
test/digests/daily.test.ts
test/server.test.ts
```

## Task 1: Scaffold Repository

**Files:**
- Create all root config files listed above.

- [ ] **Step 1: Create the repo directory**

Run:

```bash
mkdir -p /Users/orcunsahinoglu/Desktop/projects/competitor-intel-bot
cd /Users/orcunsahinoglu/Desktop/projects/competitor-intel-bot
git init
git config user.name "Ali Orcun Sahinoglu"
git config user.email "60883944+wideshreck@users.noreply.github.com"
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Write `package.json`**

Create `package.json`:

```json
{
  "name": "competitor-intel-bot",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/formbody": "^8.0.2",
    "fastify": "^5.2.1",
    "pg": "^8.13.1",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/node": "^22.10.2",
    "@types/pg": "^8.11.10",
    "eslint": "^9.17.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.19.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` exists and npm reports no critical install failure.

- [ ] **Step 4: Write TypeScript and lint config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "test", "vitest.config.ts", "eslint.config.js"]
}
```

Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

Create `eslint.config.js`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error"
    }
  }
);
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});
```

- [ ] **Step 5: Write ignores and Docker files**

Create `.gitignore`:

```text
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
data/
*.db
*.sqlite
*.sqlite3
.DS_Store
```

Create `.dockerignore`:

```text
.git
node_modules
dist
coverage
.env
.env.*
data
```

Create `Dockerfile`:

```dockerfile
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD ["node", "dist/server.js"]
```

- [ ] **Step 6: Commit scaffold**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git add .
git commit -m "chore: scaffold competitor intel bot"
```

Expected: all commands pass and one commit is created.

## Task 2: Domain Types And Config

**Files:**
- Create: `src/types.ts`
- Create: `src/config.ts`
- Create: `src/logger.ts`
- Test: `test/config.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `test/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

const baseEnv = {
  SLACK_BOT_TOKEN: "xoxb-test",
  SLACK_CHANNEL_ID: "C123",
  DATABASE_URL: "postgres://user:pass@localhost:5432/intel",
  COMPETITOR_SEEDS: "ZipSource|https://zipsource.example|procurement_ai;BuyAI|https://buyai.example|sourcing_automation"
};

describe("loadConfig", () => {
  it("loads required runtime config", () => {
    const config = loadConfig(baseEnv);

    expect(config.slack.channelId).toBe("C123");
    expect(config.database.url).toBe("postgres://user:pass@localhost:5432/intel");
    expect(config.seedCompetitors).toHaveLength(2);
    expect(config.seedCompetitors[0]).toEqual({
      name: "ZipSource",
      domain: "zipsource.example",
      category: "procurement_ai"
    });
  });

  it("defaults scheduling and scoring thresholds", () => {
    const config = loadConfig(baseEnv);

    expect(config.scheduler.dailyDigestHourUtc).toBe(16);
    expect(config.scoring.alertThreshold).toBe(0.75);
  });

  it("rejects invalid seed rows", () => {
    expect(() => loadConfig({
      ...baseEnv,
      COMPETITOR_SEEDS: "MissingParts"
    })).toThrow(/COMPETITOR_SEEDS/);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- test/config.test.ts
```

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 3: Implement domain types**

Create `src/types.ts`:

```ts
export type CompetitorStatus = "seeded" | "approved" | "candidate" | "rejected" | "archived";

export type CompetitorCategory =
  | "procurement_ai"
  | "sourcing_automation"
  | "supplier_intelligence"
  | "erp_procurement"
  | "workflow_agent"
  | "adjacent";

export type SignalType =
  | "funding"
  | "acquisition"
  | "partnership"
  | "customer_win"
  | "case_study"
  | "product_launch"
  | "feature_release"
  | "integration"
  | "ai_capability"
  | "pricing_change"
  | "positioning_change"
  | "docs_change"
  | "hiring_signal"
  | "leadership_change"
  | "new_competitor_candidate";

export type SpaceflowImplication =
  | "threat"
  | "opportunity"
  | "watch"
  | "sales_enablement"
  | "product_gap"
  | "positioning"
  | "ignore_for_now";

export type SuggestedAction =
  | "watch"
  | "research"
  | "update_battlecard"
  | "share_with_sales"
  | "review_product_gap"
  | "ignore";

export type SeedCompetitor = {
  name: string;
  domain: string;
  category: CompetitorCategory;
};

export type Competitor = {
  id: string;
  name: string;
  canonicalDomain: string;
  status: CompetitorStatus;
  category: CompetitorCategory;
  similarityScore: number;
  monitoringPriority: number;
};

export type SourceSnapshot = {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  bodyExcerpt: string;
  rawHash: string;
  contentHash: string;
  fetchedAt: string;
  metadata: Record<string, unknown>;
};

export type IntelSignal = {
  id: string;
  competitorId: string | null;
  candidateId: string | null;
  signalType: SignalType;
  claim: string;
  summary: string;
  spaceflowImplication: SpaceflowImplication;
  suggestedAction: SuggestedAction;
  relevanceScore: number;
  noveltyScore: number;
  confidenceScore: number;
  impactScore: number;
  compositeScore: number;
  sourceUrls: string[];
};

export type SlackMessage = {
  text: string;
  blocks: Array<Record<string, unknown>>;
};
```

- [ ] **Step 4: Implement config**

Create `src/config.ts`:

```ts
import { z } from "zod";

import type { CompetitorCategory, SeedCompetitor } from "./types.js";

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_CHANNEL_ID: z.string().min(1),
  DATABASE_URL: z.string().startsWith("postgres://").or(z.string().startsWith("postgresql://")),
  COMPETITOR_SEEDS: z.string().default(""),
  PORT: z.string().default("8080"),
  DAILY_DIGEST_HOUR_UTC: z.string().default("16"),
  WEEKLY_DIGEST_DAY_UTC: z.string().default("1"),
  ALERT_SCORE_THRESHOLD: z.string().default("0.75"),
  SEARCH_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini")
});

export type AppConfig = {
  port: number;
  slack: {
    botToken: string;
    channelId: string;
  };
  database: {
    url: string;
  };
  seedCompetitors: SeedCompetitor[];
  scheduler: {
    dailyDigestHourUtc: number;
    weeklyDigestDayUtc: number;
  };
  scoring: {
    alertThreshold: number;
  };
  optionalApis: {
    searchApiKey?: string;
    openAi?: { apiKey: string; model: string };
  };
};

const categories = new Set<CompetitorCategory>([
  "procurement_ai",
  "sourcing_automation",
  "supplier_intelligence",
  "erp_procurement",
  "workflow_agent",
  "adjacent"
]);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const optionalApis: AppConfig["optionalApis"] = {};
  if (parsed.SEARCH_API_KEY) {
    optionalApis.searchApiKey = parsed.SEARCH_API_KEY;
  }
  if (parsed.OPENAI_API_KEY) {
    optionalApis.openAi = { apiKey: parsed.OPENAI_API_KEY, model: parsed.OPENAI_MODEL };
  }

  return {
    port: parseInteger(parsed.PORT, "PORT"),
    slack: {
      botToken: parsed.SLACK_BOT_TOKEN,
      channelId: parsed.SLACK_CHANNEL_ID
    },
    database: {
      url: parsed.DATABASE_URL
    },
    seedCompetitors: parseSeedCompetitors(parsed.COMPETITOR_SEEDS),
    scheduler: {
      dailyDigestHourUtc: parseInteger(parsed.DAILY_DIGEST_HOUR_UTC, "DAILY_DIGEST_HOUR_UTC"),
      weeklyDigestDayUtc: parseInteger(parsed.WEEKLY_DIGEST_DAY_UTC, "WEEKLY_DIGEST_DAY_UTC")
    },
    scoring: {
      alertThreshold: parseNumber(parsed.ALERT_SCORE_THRESHOLD, "ALERT_SCORE_THRESHOLD")
    },
    optionalApis
  };
}

function parseSeedCompetitors(value: string): SeedCompetitor[] {
  if (!value.trim()) {
    return [];
  }
  return value.split(";").map((row) => {
    const [name, url, category] = row.split("|").map((item) => item.trim());
    if (!name || !url || !category || !categories.has(category as CompetitorCategory)) {
      throw new Error("COMPETITOR_SEEDS rows must use name|url|category");
    }
    return {
      name,
      domain: normalizeDomain(url),
      category: category as CompetitorCategory
    };
  });
}

function normalizeDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.replace(/^www\./i, "");
}

function parseInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function parseNumber(value: string, name: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
}
```

- [ ] **Step 5: Implement logger**

Create `src/logger.ts`:

```ts
export type Logger = {
  info(input: unknown, message?: string): void;
  warn(input: unknown, message?: string): void;
  error(input: unknown, message?: string): void;
};

export function createLogger(): Logger {
  return {
    info: (input, message) => writeLog("info", input, message),
    warn: (input, message) => writeLog("warn", input, message),
    error: (input, message) => writeLog("error", input, message)
  };
}

function writeLog(level: string, input: unknown, message?: string): void {
  const payload = {
    level,
    message,
    input,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(payload));
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- test/config.test.ts
npm run typecheck
git add src/types.ts src/config.ts src/logger.ts test/config.test.ts
git commit -m "feat: add typed runtime config"
```

Expected: tests and typecheck pass.

## Task 3: Seed Competitors And Competitor Service

**Files:**
- Create: `src/competitors/seed.ts`
- Create: `src/competitors/service.ts`
- Test: `test/competitors/seed.test.ts`
- Test: `test/storage/memory-store.test.ts`

- [ ] **Step 1: Write failing seed test**

Create `test/competitors/seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildSeedSources } from "../../src/competitors/seed.js";

describe("buildSeedSources", () => {
  it("creates default source URLs for a seed competitor", () => {
    const sources = buildSeedSources({
      name: "ZipSource",
      domain: "zipsource.example",
      category: "procurement_ai"
    });

    expect(sources).toEqual([
      { sourceType: "homepage", url: "https://zipsource.example" },
      { sourceType: "blog", url: "https://zipsource.example/blog" },
      { sourceType: "pricing", url: "https://zipsource.example/pricing" },
      { sourceType: "careers", url: "https://zipsource.example/careers" }
    ]);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- test/competitors/seed.test.ts
```

Expected: FAIL because `src/competitors/seed.ts` does not exist.

- [ ] **Step 3: Implement seed source builder**

Create `src/competitors/seed.ts`:

```ts
import type { SeedCompetitor } from "../types.js";

export type SeedSource = {
  sourceType: "homepage" | "blog" | "pricing" | "careers";
  url: string;
};

export function buildSeedSources(seed: SeedCompetitor): SeedSource[] {
  const base = `https://${seed.domain}`;
  return [
    { sourceType: "homepage", url: base },
    { sourceType: "blog", url: `${base}/blog` },
    { sourceType: "pricing", url: `${base}/pricing` },
    { sourceType: "careers", url: `${base}/careers` }
  ];
}
```

- [ ] **Step 4: Define Store interface and memory store test**

Create `test/storage/memory-store.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { MemoryStore } from "../../src/storage/memory-store.js";

describe("MemoryStore", () => {
  it("upserts seed competitors and sources", async () => {
    const store = new MemoryStore();
    const competitor = await store.upsertCompetitor({
      name: "ZipSource",
      canonicalDomain: "zipsource.example",
      status: "seeded",
      category: "procurement_ai",
      similarityScore: 0.9,
      monitoringPriority: 1
    });

    await store.upsertSource({
      competitorId: competitor.id,
      sourceType: "homepage",
      url: "https://zipsource.example",
      enabled: true
    });

    await expect(store.listCompetitors()).resolves.toHaveLength(1);
    await expect(store.listEnabledSources()).resolves.toHaveLength(1);
  });
});
```

- [ ] **Step 5: Implement Store interface and MemoryStore**

Create `src/storage/memory-store.ts`:

```ts
import { randomUUID } from "node:crypto";

import type { Competitor, CompetitorCategory, CompetitorStatus } from "../types.js";

export type UpsertCompetitorInput = {
  name: string;
  canonicalDomain: string;
  status: CompetitorStatus;
  category: CompetitorCategory;
  similarityScore: number;
  monitoringPriority: number;
};

export type SourceRecord = {
  id: string;
  competitorId: string;
  sourceType: string;
  url: string;
  enabled: boolean;
};

export type UpsertSourceInput = Omit<SourceRecord, "id">;

export interface Store {
  upsertCompetitor(input: UpsertCompetitorInput): Promise<Competitor>;
  listCompetitors(): Promise<Competitor[]>;
  upsertSource(input: UpsertSourceInput): Promise<SourceRecord>;
  listEnabledSources(): Promise<SourceRecord[]>;
}

export class MemoryStore implements Store {
  private readonly competitors = new Map<string, Competitor>();
  private readonly sources = new Map<string, SourceRecord>();

  async upsertCompetitor(input: UpsertCompetitorInput): Promise<Competitor> {
    const existing = [...this.competitors.values()].find(
      (competitor) => competitor.canonicalDomain === input.canonicalDomain
    );
    const competitor: Competitor = {
      id: existing?.id ?? randomUUID(),
      ...input
    };
    this.competitors.set(competitor.id, competitor);
    return competitor;
  }

  async listCompetitors(): Promise<Competitor[]> {
    return [...this.competitors.values()].map((competitor) => ({ ...competitor }));
  }

  async upsertSource(input: UpsertSourceInput): Promise<SourceRecord> {
    const existing = [...this.sources.values()].find(
      (source) => source.competitorId === input.competitorId && source.url === input.url
    );
    const source: SourceRecord = {
      id: existing?.id ?? randomUUID(),
      ...input
    };
    this.sources.set(source.id, source);
    return source;
  }

  async listEnabledSources(): Promise<SourceRecord[]> {
    return [...this.sources.values()]
      .filter((source) => source.enabled)
      .map((source) => ({ ...source }));
  }
}
```

- [ ] **Step 6: Implement competitor service**

Create `src/competitors/service.ts`:

```ts
import type { SeedCompetitor } from "../types.js";
import type { Store } from "../storage/memory-store.js";
import { buildSeedSources } from "./seed.js";

export async function seedCompetitors(store: Store, seeds: SeedCompetitor[]): Promise<void> {
  for (const seed of seeds) {
    const competitor = await store.upsertCompetitor({
      name: seed.name,
      canonicalDomain: seed.domain,
      status: "seeded",
      category: seed.category,
      similarityScore: 0.8,
      monitoringPriority: 1
    });
    for (const source of buildSeedSources(seed)) {
      await store.upsertSource({
        competitorId: competitor.id,
        sourceType: source.sourceType,
        url: source.url,
        enabled: true
      });
    }
  }
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
npm test -- test/competitors/seed.test.ts test/storage/memory-store.test.ts
npm run typecheck
git add src/competitors src/storage/memory-store.ts test/competitors test/storage
git commit -m "feat: add competitor seed graph"
```

Expected: tests and typecheck pass.

## Task 4: Source Normalization And Signal Extraction

**Files:**
- Create: `src/sources/normalize.ts`
- Create: `src/signals/extract.ts`
- Test: `test/sources/normalize.test.ts`
- Test: `test/signals/extract.test.ts`

- [ ] **Step 1: Write source normalization test**

Create `test/sources/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { normalizeSnapshot } from "../../src/sources/normalize.js";

describe("normalizeSnapshot", () => {
  it("creates stable hashes and trimmed excerpts", () => {
    const snapshot = normalizeSnapshot({
      sourceId: "source-1",
      url: "https://zipsource.example/blog/launch",
      title: "  Supplier Agent Launch  ",
      body: "ZipSource launched a supplier onboarding agent for enterprise procurement teams.",
      fetchedAt: "2026-06-09T00:00:00.000Z"
    });

    expect(snapshot.title).toBe("Supplier Agent Launch");
    expect(snapshot.bodyExcerpt).toContain("supplier onboarding agent");
    expect(snapshot.rawHash).toHaveLength(64);
    expect(snapshot.contentHash).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Write signal extraction test**

Create `test/signals/extract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { extractSignals } from "../../src/signals/extract.js";

describe("extractSignals", () => {
  it("extracts product launch and customer win signals", () => {
    const signals = extractSignals({
      competitorId: "competitor-1",
      snapshotId: "snapshot-1",
      url: "https://zipsource.example/blog/acme",
      title: "Acme Foods launches with ZipSource",
      bodyExcerpt: "ZipSource launched supplier onboarding agents with Acme Foods as a new enterprise customer."
    });

    expect(signals.map((signal) => signal.signalType)).toEqual(["customer_win", "product_launch"]);
    expect(signals[0]?.sourceUrls).toEqual(["https://zipsource.example/blog/acme"]);
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -- test/sources/normalize.test.ts test/signals/extract.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement source normalization**

Create `src/sources/normalize.ts`:

```ts
import { createHash, randomUUID } from "node:crypto";

import type { SourceSnapshot } from "../types.js";

export type NormalizeSnapshotInput = {
  sourceId: string;
  url: string;
  title: string;
  body: string;
  fetchedAt: string;
  metadata?: Record<string, unknown>;
};

export function normalizeSnapshot(input: NormalizeSnapshotInput): SourceSnapshot {
  const title = normalizeWhitespace(input.title);
  const body = normalizeWhitespace(input.body);
  return {
    id: randomUUID(),
    sourceId: input.sourceId,
    url: input.url,
    title,
    bodyExcerpt: body.slice(0, 1200),
    rawHash: sha256(`${input.title}\n${input.body}`),
    contentHash: sha256(`${title}\n${body}`),
    fetchedAt: input.fetchedAt,
    metadata: input.metadata ?? {}
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
```

- [ ] **Step 5: Implement deterministic signal extraction**

Create `src/signals/extract.ts`:

```ts
import { randomUUID } from "node:crypto";

import type { IntelSignal, SignalType } from "../types.js";

export type ExtractSignalsInput = {
  competitorId: string | null;
  candidateId?: string | null;
  snapshotId: string;
  url: string;
  title: string;
  bodyExcerpt: string;
};

const rules: Array<{ type: SignalType; pattern: RegExp; implication: IntelSignal["spaceflowImplication"]; action: IntelSignal["suggestedAction"] }> = [
  { type: "funding", pattern: /\b(raised|funding|series\s+[abc]|seed round)\b/i, implication: "threat", action: "watch" },
  { type: "customer_win", pattern: /\b(customer|client|case study|launches with|selected by)\b/i, implication: "sales_enablement", action: "update_battlecard" },
  { type: "product_launch", pattern: /\b(launched|introducing|announced|new product|new feature)\b/i, implication: "product_gap", action: "review_product_gap" },
  { type: "integration", pattern: /\b(integration|integrates|api|connector)\b/i, implication: "product_gap", action: "review_product_gap" },
  { type: "pricing_change", pattern: /\b(pricing|package|plan|tier)\b/i, implication: "positioning", action: "research" },
  { type: "hiring_signal", pattern: /\b(hiring|job|careers|head of|vp of)\b/i, implication: "watch", action: "watch" }
];

export function extractSignals(input: ExtractSignalsInput): IntelSignal[] {
  const text = `${input.title}\n${input.bodyExcerpt}`;
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({
      id: randomUUID(),
      competitorId: input.competitorId,
      candidateId: input.candidateId ?? null,
      signalType: rule.type,
      claim: buildClaim(rule.type, input.title),
      summary: input.bodyExcerpt.slice(0, 500),
      spaceflowImplication: rule.implication,
      suggestedAction: rule.action,
      relevanceScore: 0,
      noveltyScore: 0,
      confidenceScore: 0,
      impactScore: 0,
      compositeScore: 0,
      sourceUrls: [input.url]
    }));
}

function buildClaim(type: SignalType, title: string): string {
  return `${type}: ${title}`.slice(0, 180);
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- test/sources/normalize.test.ts test/signals/extract.test.ts
npm run typecheck
git add src/sources src/signals/extract.ts test/sources test/signals/extract.test.ts
git commit -m "feat: extract source-backed intel signals"
```

Expected: tests and typecheck pass.

## Task 5: Signal Scoring And Digest Selection

**Files:**
- Create: `src/signals/scoring.ts`
- Create: `src/digests/daily.ts`
- Test: `test/signals/scoring.test.ts`
- Test: `test/digests/daily.test.ts`

- [ ] **Step 1: Write scoring tests**

Create `test/signals/scoring.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { scoreSignal, shouldAlert } from "../../src/signals/scoring.js";

describe("scoreSignal", () => {
  it("scores high-impact product launches above alert threshold", () => {
    const scored = scoreSignal({
      signalType: "product_launch",
      sourceUrls: ["https://zipsource.example/blog/launch"],
      previousSimilarCount: 0,
      competitorSimilarityScore: 0.9
    });

    expect(scored.compositeScore).toBeGreaterThanOrEqual(0.75);
    expect(shouldAlert(scored, 0.75)).toBe(true);
  });

  it("keeps repeated low-confidence docs changes out of alerts", () => {
    const scored = scoreSignal({
      signalType: "docs_change",
      sourceUrls: ["https://third-party.example/article"],
      previousSimilarCount: 3,
      competitorSimilarityScore: 0.5
    });

    expect(shouldAlert(scored, 0.75)).toBe(false);
  });
});
```

- [ ] **Step 2: Write digest tests**

Create `test/digests/daily.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { selectDailyDigestSignals } from "../../src/digests/daily.js";
import type { IntelSignal } from "../../src/types.js";

describe("selectDailyDigestSignals", () => {
  it("selects top five signals by composite score", () => {
    const signals = Array.from({ length: 7 }, (_, index): IntelSignal => ({
      id: `signal-${index}`,
      competitorId: "competitor-1",
      candidateId: null,
      signalType: "product_launch",
      claim: `Signal ${index}`,
      summary: "Summary",
      spaceflowImplication: "watch",
      suggestedAction: "watch",
      relevanceScore: 0.8,
      noveltyScore: 0.8,
      confidenceScore: 0.8,
      impactScore: 0.8,
      compositeScore: index / 10,
      sourceUrls: ["https://example.com"]
    }));

    expect(selectDailyDigestSignals(signals).map((signal) => signal.id)).toEqual([
      "signal-6",
      "signal-5",
      "signal-4",
      "signal-3",
      "signal-2"
    ]);
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -- test/signals/scoring.test.ts test/digests/daily.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement scoring**

Create `src/signals/scoring.ts`:

```ts
import type { SignalType } from "../types.js";

export type ScoreSignalInput = {
  signalType: SignalType;
  sourceUrls: string[];
  previousSimilarCount: number;
  competitorSimilarityScore: number;
};

export type SignalScores = {
  relevanceScore: number;
  noveltyScore: number;
  confidenceScore: number;
  impactScore: number;
  compositeScore: number;
};

const impactByType: Record<SignalType, number> = {
  funding: 0.95,
  acquisition: 0.95,
  partnership: 0.8,
  customer_win: 0.9,
  case_study: 0.75,
  product_launch: 0.9,
  feature_release: 0.75,
  integration: 0.75,
  ai_capability: 0.85,
  pricing_change: 0.85,
  positioning_change: 0.7,
  docs_change: 0.45,
  hiring_signal: 0.6,
  leadership_change: 0.65,
  new_competitor_candidate: 0.7
};

export function scoreSignal(input: ScoreSignalInput): SignalScores {
  const relevanceScore = clamp(input.competitorSimilarityScore);
  const noveltyScore = clamp(1 - input.previousSimilarCount * 0.25);
  const confidenceScore = confidenceFromSources(input.sourceUrls);
  const impactScore = impactByType[input.signalType];
  const compositeScore = clamp(
    0.3 * relevanceScore + 0.25 * impactScore + 0.25 * confidenceScore + 0.2 * noveltyScore
  );
  return { relevanceScore, noveltyScore, confidenceScore, impactScore, compositeScore };
}

export function shouldAlert(scores: SignalScores, threshold: number): boolean {
  return scores.compositeScore >= threshold || scores.impactScore >= 0.85 && scores.confidenceScore >= 0.65;
}

function confidenceFromSources(urls: string[]): number {
  const hasPrimary = urls.some((url) => !/third-party|news|medium\.com/i.test(url));
  return hasPrimary ? 0.85 : 0.55;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}
```

- [ ] **Step 5: Implement daily digest selector**

Create `src/digests/daily.ts`:

```ts
import type { IntelSignal } from "../types.js";

export function selectDailyDigestSignals(signals: IntelSignal[], limit = 5): IntelSignal[] {
  return [...signals]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, limit);
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm test -- test/signals/scoring.test.ts test/digests/daily.test.ts
npm run typecheck
git add src/signals/scoring.ts src/digests test/signals/scoring.test.ts test/digests
git commit -m "feat: score and select intel signals"
```

Expected: tests and typecheck pass.

## Task 6: Slack Rendering And Client

**Files:**
- Create: `src/slack/render.ts`
- Create: `src/slack/client.ts`
- Test: `test/slack/render.test.ts`

- [ ] **Step 1: Write Slack render tests**

Create `test/slack/render.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { renderDailyDigestMessage, renderSignalAlertMessage } from "../../src/slack/render.js";
import type { IntelSignal } from "../../src/types.js";

const signal: IntelSignal = {
  id: "signal-1",
  competitorId: "competitor-1",
  candidateId: null,
  signalType: "product_launch",
  claim: "product_launch: Supplier agent launched",
  summary: "ZipSource launched supplier onboarding agents.",
  spaceflowImplication: "product_gap",
  suggestedAction: "review_product_gap",
  relevanceScore: 0.9,
  noveltyScore: 1,
  confidenceScore: 0.85,
  impactScore: 0.9,
  compositeScore: 0.89,
  sourceUrls: ["https://zipsource.example/blog/launch"]
};

describe("Slack renderers", () => {
  it("renders high-signal alerts with source links", () => {
    const message = renderSignalAlertMessage(signal);

    expect(message.text).toContain("Competitor signal");
    expect(JSON.stringify(message.blocks)).toContain("product_launch");
    expect(JSON.stringify(message.blocks)).toContain("https://zipsource.example/blog/launch");
  });

  it("renders daily digest with top signals", () => {
    const message = renderDailyDigestMessage([signal]);

    expect(message.text).toBe("Daily competitor intel digest: 1 signal");
    expect(JSON.stringify(message.blocks)).toContain("Supplier agent launched");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- test/slack/render.test.ts
```

Expected: FAIL because render module does not exist.

- [ ] **Step 3: Implement Slack renderers**

Create `src/slack/render.ts`:

```ts
import type { IntelSignal, SlackMessage } from "../types.js";

export function renderSignalAlertMessage(signal: IntelSignal): SlackMessage {
  return {
    text: `Competitor signal: ${signal.claim}`,
    blocks: [
      header("Competitor signal"),
      section(`*${signal.claim}*\n${signal.summary}`),
      fields([
        ["Type", signal.signalType],
        ["Score", signal.compositeScore.toFixed(2)],
        ["Confidence", signal.confidenceScore.toFixed(2)],
        ["Implication", signal.spaceflowImplication],
        ["Action", signal.suggestedAction]
      ]),
      section(`*Sources*\n${signal.sourceUrls.map((url, index) => `${index + 1}. ${url}`).join("\n")}`)
    ]
  };
}

export function renderDailyDigestMessage(signals: IntelSignal[]): SlackMessage {
  const label = signals.length === 1 ? "signal" : "signals";
  return {
    text: `Daily competitor intel digest: ${signals.length} ${label}`,
    blocks: [
      header("Daily competitor intel digest"),
      section(signals.length ? signals.map(formatDigestSignal).join("\n\n") : "No new competitor signals.")
    ]
  };
}

function formatDigestSignal(signal: IntelSignal): string {
  return `*${signal.claim}*\nScore ${signal.compositeScore.toFixed(2)} · ${signal.suggestedAction}\n${signal.sourceUrls[0] ?? ""}`;
}

function header(text: string): Record<string, unknown> {
  return { type: "header", text: { type: "plain_text", text } };
}

function section(text: string): Record<string, unknown> {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function fields(items: Array<[string, string]>): Record<string, unknown> {
  return {
    type: "section",
    fields: items.map(([label, value]) => ({ type: "mrkdwn", text: `*${label}*\n${value}` }))
  };
}
```

- [ ] **Step 4: Implement Slack client**

Create `src/slack/client.ts`:

```ts
import type { SlackMessage } from "../types.js";

export class SlackClient {
  constructor(private readonly options: { token: string }) {}

  async postMessage(channel: string, message: SlackMessage): Promise<{ channel: string; ts: string }> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel,
        text: message.text,
        blocks: message.blocks
      })
    });
    const json = await response.json() as { ok?: boolean; channel?: string; ts?: string; error?: string };
    if (!json.ok || !json.channel || !json.ts) {
      throw new Error(`Slack post failed: ${json.error ?? "unknown_error"}`);
    }
    return { channel: json.channel, ts: json.ts };
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- test/slack/render.test.ts
npm run typecheck
git add src/slack test/slack
git commit -m "feat: render competitor intel slack messages"
```

Expected: tests and typecheck pass.

## Task 7: Jobs And Server Endpoints

**Files:**
- Create: `src/jobs/run-collection.ts`
- Create: `src/jobs/run-digest.ts`
- Create: `src/server.ts`
- Test: `test/server.test.ts`

- [ ] **Step 1: Write server test**

Create `test/server.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";

describe("server", () => {
  it("responds to health checks", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, postedSignals: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 })
    });

    const response = await server.inject({ method: "GET", url: "/ping" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("PONG");
  });

  it("runs collection job endpoint", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 2, postedSignals: 1 }),
      runDailyDigest: async () => ({ postedSignals: 0 })
    });

    const response = await server.inject({ method: "POST", url: "/jobs/collect" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ processedSignals: 2, postedSignals: 1 });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
npm test -- test/server.test.ts
```

Expected: FAIL because server module does not exist.

- [ ] **Step 3: Implement job entrypoints**

Create `src/jobs/run-collection.ts`:

```ts
export type CollectionResult = {
  processedSignals: number;
  postedSignals: number;
};

export async function runCollectionJob(): Promise<CollectionResult> {
  return { processedSignals: 0, postedSignals: 0 };
}
```

Create `src/jobs/run-digest.ts`:

```ts
export type DigestResult = {
  postedSignals: number;
};

export async function runDailyDigestJob(): Promise<DigestResult> {
  return { postedSignals: 0 };
}
```

- [ ] **Step 4: Implement Fastify server**

Create `src/server.ts`:

```ts
import Fastify from "fastify";

import { loadConfig } from "./config.js";
import { runCollectionJob, type CollectionResult } from "./jobs/run-collection.js";
import { runDailyDigestJob, type DigestResult } from "./jobs/run-digest.js";

export type ServerDeps = {
  runCollection: () => Promise<CollectionResult>;
  runDailyDigest: () => Promise<DigestResult>;
};

export function buildServer(deps: ServerDeps) {
  const server = Fastify({ logger: false });

  server.get("/ping", async (_request, reply) => {
    return reply.type("text/plain").send("PONG");
  });

  server.post("/jobs/collect", async () => deps.runCollection());
  server.post("/jobs/daily-digest", async () => deps.runDailyDigest());

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const server = buildServer({
    runCollection: runCollectionJob,
    runDailyDigest: runDailyDigestJob
  });
  await server.listen({ port: config.port, host: "0.0.0.0" });
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm test -- test/server.test.ts
npm run typecheck
git add src/jobs src/server.ts test/server.test.ts
git commit -m "feat: add scheduler job endpoints"
```

Expected: tests and typecheck pass.

## Task 8: Postgres Store And Deployment Docs

**Files:**
- Create: `src/storage/postgres-store.ts`
- Create: `src/storage/index.ts`
- Create: `.env.example`
- Create: `README.md`
- Create: `docker-compose.yml`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Implement Postgres migrations**

Create `src/storage/postgres-store.ts`:

```ts
import pg from "pg";

import type { Competitor } from "../types.js";
import type { SourceRecord, Store, UpsertCompetitorInput, UpsertSourceInput } from "./memory-store.js";

export class PostgresStore implements Store {
  private readonly pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url });
  }

  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS competitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        canonical_domain TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        category TEXT NOT NULL,
        similarity_score DOUBLE PRECISION NOT NULL,
        monitoring_priority INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS competitor_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        url TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (competitor_id, url)
      );
    `);
  }

  async upsertCompetitor(input: UpsertCompetitorInput): Promise<Competitor> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      canonical_domain: string;
      status: Competitor["status"];
      category: Competitor["category"];
      similarity_score: number;
      monitoring_priority: number;
    }>(`
      INSERT INTO competitors (name, canonical_domain, status, category, similarity_score, monitoring_priority)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (canonical_domain) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        category = EXCLUDED.category,
        similarity_score = EXCLUDED.similarity_score,
        monitoring_priority = EXCLUDED.monitoring_priority,
        updated_at = NOW()
      RETURNING id, name, canonical_domain, status, category, similarity_score, monitoring_priority
    `, [
      input.name,
      input.canonicalDomain,
      input.status,
      input.category,
      input.similarityScore,
      input.monitoringPriority
    ]);
    return mapCompetitor(result.rows[0]);
  }

  async listCompetitors(): Promise<Competitor[]> {
    const result = await this.pool.query("SELECT id, name, canonical_domain, status, category, similarity_score, monitoring_priority FROM competitors ORDER BY name");
    return result.rows.map(mapCompetitor);
  }

  async upsertSource(input: UpsertSourceInput): Promise<SourceRecord> {
    const result = await this.pool.query<{
      id: string;
      competitor_id: string;
      source_type: string;
      url: string;
      enabled: boolean;
    }>(`
      INSERT INTO competitor_sources (competitor_id, source_type, url, enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (competitor_id, url) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING id, competitor_id, source_type, url, enabled
    `, [input.competitorId, input.sourceType, input.url, input.enabled]);
    const row = result.rows[0];
    return {
      id: row.id,
      competitorId: row.competitor_id,
      sourceType: row.source_type,
      url: row.url,
      enabled: row.enabled
    };
  }

  async listEnabledSources(): Promise<SourceRecord[]> {
    const result = await this.pool.query<{
      id: string;
      competitor_id: string;
      source_type: string;
      url: string;
      enabled: boolean;
    }>("SELECT id, competitor_id, source_type, url, enabled FROM competitor_sources WHERE enabled = TRUE ORDER BY url");
    return result.rows.map((row) => ({
      id: row.id,
      competitorId: row.competitor_id,
      sourceType: row.source_type,
      url: row.url,
      enabled: row.enabled
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function mapCompetitor(row: {
  id: string;
  name: string;
  canonical_domain: string;
  status: Competitor["status"];
  category: Competitor["category"];
  similarity_score: number;
  monitoring_priority: number;
} | undefined): Competitor {
  if (!row) {
    throw new Error("Expected competitor row");
  }
  return {
    id: row.id,
    name: row.name,
    canonicalDomain: row.canonical_domain,
    status: row.status,
    category: row.category,
    similarityScore: row.similarity_score,
    monitoringPriority: row.monitoring_priority
  };
}
```

- [ ] **Step 2: Implement store factory**

Create `src/storage/index.ts`:

```ts
import type { AppConfig } from "../config.js";
import type { Store } from "./memory-store.js";
import { PostgresStore } from "./postgres-store.js";

export async function createStore(config: AppConfig["database"]): Promise<Store> {
  const store = new PostgresStore(config.url);
  await store.migrate();
  return store;
}
```

- [ ] **Step 3: Write env template**

Create `.env.example`:

```text
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C0123456789
DATABASE_URL=postgres://competitor_intel:competitor_intel@localhost:5432/competitor_intel

COMPETITOR_SEEDS=ZipSource|https://zipsource.example|procurement_ai;BuyAI|https://buyai.example|sourcing_automation

PORT=8080
DAILY_DIGEST_HOUR_UTC=16
WEEKLY_DIGEST_DAY_UTC=1
ALERT_SCORE_THRESHOLD=0.75

SEARCH_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

- [ ] **Step 4: Write local Postgres compose**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: competitor_intel
      POSTGRES_PASSWORD: competitor_intel
      POSTGRES_DB: competitor_intel
    ports:
      - "5433:5432"
    volumes:
      - competitor-intel-postgres:/var/lib/postgresql/data

volumes:
  competitor-intel-postgres:
```

- [ ] **Step 5: Write README**

Create `README.md`:

```markdown
# Competitor Intel Bot

Internal Spaceflow Slack bot for procurement AI and sourcing automation competitor intelligence.

## What It Does

- Tracks seeded competitors and known public sources.
- Extracts source-backed intel signals.
- Scores relevance, novelty, confidence, and impact.
- Posts high-signal alerts to Slack.
- Produces daily and weekly digest jobs.
- Stores competitor graph data in Postgres.

## Local Setup

\`\`\`bash
npm install
cp .env.example .env
docker compose up -d
npm run build
npm start
\`\`\`

Health check:

\`\`\`bash
curl http://localhost:8080/ping
\`\`\`

Job endpoints:

\`\`\`bash
curl -X POST http://localhost:8080/jobs/collect
curl -X POST http://localhost:8080/jobs/daily-digest
\`\`\`

## Required Env

- `SLACK_BOT_TOKEN`
- `SLACK_CHANNEL_ID`
- `DATABASE_URL`
- `COMPETITOR_SEEDS`

## Deployment

Deploy to Cloud Run with Cloud SQL Postgres and Secret Manager. Cloud Scheduler calls:

- `POST /jobs/collect`
- `POST /jobs/daily-digest`

## Development

\`\`\`bash
npm test
npm run typecheck
npm run lint
npm run build
\`\`\`
```

- [ ] **Step 6: Write CI**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
```

- [ ] **Step 7: Run full verification and commit**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git add .
git commit -m "feat: add postgres storage and deployment docs"
```

Expected: all verification commands pass and commit is created.

## Task 9: Publish Repo

**Files:**
- No file changes unless GitHub rejects repo creation.

- [ ] **Step 1: Verify no secrets are staged**

Run:

```bash
git status --short
git ls-files | rg '^\\.env$|^\\.env\\.|private-key|\\.pem$' || true
```

Expected: no secret files. `.env.example` is allowed.

- [ ] **Step 2: Create GitHub org repo**

Run:

```bash
gh repo view Spaceflow-Technologies-INC/competitor-intel-bot --json nameWithOwner,url,visibility || \
gh repo create Spaceflow-Technologies-INC/competitor-intel-bot --public --description "Internal Slack bot for Spaceflow competitor intelligence." --source . --remote origin --push
```

Expected: repo exists and `main` is pushed.

- [ ] **Step 3: Verify remote**

Run:

```bash
git status --short --branch
gh repo view Spaceflow-Technologies-INC/competitor-intel-bot --json nameWithOwner,url,visibility,defaultBranchRef
```

Expected: branch tracks `origin/main`, repo visibility is public or internal as selected by org policy, default branch is `main`.

## Self-Review Checklist

- Spec coverage:
  - Competitor graph: Tasks 3 and 8.
  - Hybrid source engine foundation: Tasks 4 and 7.
  - Public-first optional APIs: Task 2 config and Task 8 docs.
  - Scoring and alert thresholds: Task 5.
  - Slack high-signal and digest rendering: Task 6.
  - Cloud Run deployment shape: Tasks 1 and 8.
  - Tests and CI: Tasks 1 through 8.

- Placeholder scan:
  - No unfinished-marker or vague "add later" steps.
  - Open questions from the design are intentionally deferred from V1 and not required for scaffold completion.

- Type consistency:
  - `Competitor`, `SourceSnapshot`, `IntelSignal`, `Store`, and config fields are introduced before later tasks use them.
  - `record` methods are not referenced before `Store` defines them.
