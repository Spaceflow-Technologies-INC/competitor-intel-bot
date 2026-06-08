import pg from "pg";

import type { Competitor, IntelSignal, SignalType } from "../types.js";
import type {
  RecordSignalInput,
  RecordSignalResult,
  SourceRecord,
  Store,
  UpsertCompetitorInput,
  UpsertSourceInput
} from "./memory-store.js";

export class PostgresStore implements Store {
  private readonly pool: pg.Pool;

  constructor(url: string) {
    this.pool = new pg.Pool({ connectionString: url });
  }

  async migrate(): Promise<void> {
    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

      CREATE TABLE IF NOT EXISTS intel_signals (
        id UUID PRIMARY KEY,
        unique_key TEXT NOT NULL UNIQUE,
        competitor_id UUID NULL REFERENCES competitors(id) ON DELETE SET NULL,
        candidate_id TEXT NULL,
        signal_type TEXT NOT NULL,
        claim TEXT NOT NULL,
        summary TEXT NOT NULL,
        spaceflow_implication TEXT NOT NULL,
        suggested_action TEXT NOT NULL,
        relevance_score DOUBLE PRECISION NOT NULL,
        novelty_score DOUBLE PRECISION NOT NULL,
        confidence_score DOUBLE PRECISION NOT NULL,
        impact_score DOUBLE PRECISION NOT NULL,
        composite_score DOUBLE PRECISION NOT NULL,
        source_urls JSONB NOT NULL,
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        posted_at TIMESTAMPTZ NULL
      );

      CREATE INDEX IF NOT EXISTS intel_signals_unposted_score_idx
        ON intel_signals (posted_at, composite_score DESC);
    `);
  }

  async upsertCompetitor(input: UpsertCompetitorInput): Promise<Competitor> {
    const result = await this.pool.query<CompetitorRow>(
      `
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
      `,
      [
        input.name,
        input.canonicalDomain,
        input.status,
        input.category,
        input.similarityScore,
        input.monitoringPriority
      ]
    );
    return mapCompetitor(result.rows[0]);
  }

  async listCompetitors(): Promise<Competitor[]> {
    const result = await this.pool.query<CompetitorRow>(
      "SELECT id, name, canonical_domain, status, category, similarity_score, monitoring_priority FROM competitors ORDER BY name"
    );
    return result.rows.map(mapCompetitor);
  }

  async upsertSource(input: UpsertSourceInput): Promise<SourceRecord> {
    const result = await this.pool.query<SourceRow>(
      `
      INSERT INTO competitor_sources (competitor_id, source_type, url, enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (competitor_id, url) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING id, competitor_id, source_type, url, enabled
      `,
      [input.competitorId, input.sourceType, input.url, input.enabled]
    );
    return mapSource(result.rows[0]);
  }

  async listEnabledSources(): Promise<SourceRecord[]> {
    const result = await this.pool.query<SourceRow>(
      "SELECT id, competitor_id, source_type, url, enabled FROM competitor_sources WHERE enabled = TRUE ORDER BY url"
    );
    return result.rows.map(mapSource);
  }

  async recordSignal(input: RecordSignalInput): Promise<RecordSignalResult> {
    const existing = await this.pool.query<SignalRow>(
      "SELECT * FROM intel_signals WHERE unique_key = $1",
      [input.uniqueKey]
    );
    if (existing.rows[0]) {
      return { signal: mapSignal(existing.rows[0]), created: false };
    }
    const result = await this.pool.query<SignalRow>(
      `
      INSERT INTO intel_signals (
        id, unique_key, competitor_id, candidate_id, signal_type, claim, summary,
        spaceflow_implication, suggested_action, relevance_score, novelty_score,
        confidence_score, impact_score, composite_score, source_urls
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING *
      `,
      [
        input.signal.id,
        input.uniqueKey,
        input.signal.competitorId,
        input.signal.candidateId,
        input.signal.signalType,
        input.signal.claim,
        input.signal.summary,
        input.signal.spaceflowImplication,
        input.signal.suggestedAction,
        input.signal.relevanceScore,
        input.signal.noveltyScore,
        input.signal.confidenceScore,
        input.signal.impactScore,
        input.signal.compositeScore,
        JSON.stringify(input.signal.sourceUrls)
      ]
    );
    return { signal: mapSignal(result.rows[0]), created: true };
  }

  async listUnpostedSignals(limit = 10): Promise<IntelSignal[]> {
    const result = await this.pool.query<SignalRow>(
      "SELECT * FROM intel_signals WHERE posted_at IS NULL ORDER BY composite_score DESC, first_seen_at DESC LIMIT $1",
      [limit]
    );
    return result.rows.map(mapSignal);
  }

  async markSignalsPosted(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.pool.query("UPDATE intel_signals SET posted_at = NOW() WHERE id = ANY($1::uuid[])", [ids]);
  }

  async countSimilarSignals(input: { competitorId: string | null; signalType: SignalType }): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM intel_signals WHERE competitor_id IS NOT DISTINCT FROM $1 AND signal_type = $2",
      [input.competitorId, input.signalType]
    );
    return Number.parseInt(result.rows[0]?.count ?? "0", 10);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

type CompetitorRow = {
  id: string;
  name: string;
  canonical_domain: string;
  status: Competitor["status"];
  category: Competitor["category"];
  similarity_score: number;
  monitoring_priority: number;
};

type SourceRow = {
  id: string;
  competitor_id: string;
  source_type: string;
  url: string;
  enabled: boolean;
};

type SignalRow = {
  id: string;
  competitor_id: string | null;
  candidate_id: string | null;
  signal_type: IntelSignal["signalType"];
  claim: string;
  summary: string;
  spaceflow_implication: IntelSignal["spaceflowImplication"];
  suggested_action: IntelSignal["suggestedAction"];
  relevance_score: number;
  novelty_score: number;
  confidence_score: number;
  impact_score: number;
  composite_score: number;
  source_urls: unknown;
};

function mapCompetitor(row: CompetitorRow | undefined): Competitor {
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

function mapSource(row: SourceRow | undefined): SourceRecord {
  if (!row) {
    throw new Error("Expected source row");
  }
  return {
    id: row.id,
    competitorId: row.competitor_id,
    sourceType: row.source_type,
    url: row.url,
    enabled: row.enabled
  };
}

function mapSignal(row: SignalRow | undefined): IntelSignal {
  if (!row) {
    throw new Error("Expected signal row");
  }
  return {
    id: row.id,
    competitorId: row.competitor_id,
    candidateId: row.candidate_id,
    signalType: row.signal_type,
    claim: row.claim,
    summary: row.summary,
    spaceflowImplication: row.spaceflow_implication,
    suggestedAction: row.suggested_action,
    relevanceScore: row.relevance_score,
    noveltyScore: row.novelty_score,
    confidenceScore: row.confidence_score,
    impactScore: row.impact_score,
    compositeScore: row.composite_score,
    sourceUrls: parseSourceUrls(row.source_urls)
  };
}

function parseSourceUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  }
  return [];
}
