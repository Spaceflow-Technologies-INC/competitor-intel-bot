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
import { mapCompetitor, mapSignal, mapSource, type CompetitorRow, type SignalRow, type SourceRow } from "./postgres-mappers.js";

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

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
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
      [input.name, input.canonicalDomain, input.status, input.category, input.similarityScore, input.monitoringPriority]
    );
    return mapCompetitor(result.rows[0]);
  }

  async listCompetitors(): Promise<Competitor[]> {
    const result = await this.pool.query<CompetitorRow>(
      "SELECT id, name, canonical_domain, status, category, similarity_score, monitoring_priority FROM competitors ORDER BY name"
    );
    return result.rows.map(mapCompetitor);
  }

  async updateCompetitorStatus(input: { id: string; status: Competitor["status"] }): Promise<Competitor> {
    const result = await this.pool.query<CompetitorRow>(
      `
      UPDATE competitors SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, canonical_domain, status, category, similarity_score, monitoring_priority
      `,
      [input.id, input.status]
    );
    return mapCompetitor(result.rows[0]);
  }

  async deleteCompetitor(id: string): Promise<Competitor> {
    const result = await this.pool.query<CompetitorRow>(
      `
      DELETE FROM competitors
      WHERE id = $1
      RETURNING id, name, canonical_domain, status, category, similarity_score, monitoring_priority
      `,
      [id]
    );
    return mapCompetitor(result.rows[0]);
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

  async listSourcesForCompetitor(competitorId: string): Promise<SourceRecord[]> {
    const result = await this.pool.query<SourceRow>(
      "SELECT id, competitor_id, source_type, url, enabled FROM competitor_sources WHERE competitor_id = $1 ORDER BY source_type, url",
      [competitorId]
    );
    return result.rows.map(mapSource);
  }

  async recordSignal(input: RecordSignalInput): Promise<RecordSignalResult> {
    const existing = await this.pool.query<SignalRow>(
      "SELECT * FROM intel_signals WHERE unique_key = $1",
      [input.uniqueKey]
    );
    if (existing.rows[0]) {
      const existingSignal = mapSignal(existing.rows[0]);
      const sourceUrls = [...new Set([...existingSignal.sourceUrls, ...input.signal.sourceUrls])];
      const result = await this.pool.query<SignalRow>(
        `
        UPDATE intel_signals SET
          confidence_score = GREATEST(confidence_score, $2),
          composite_score = GREATEST(composite_score, $3),
          source_urls = $4::jsonb
        WHERE unique_key = $1
        RETURNING *
        `,
        [input.uniqueKey, input.signal.confidenceScore, input.signal.compositeScore, JSON.stringify(sourceUrls)]
      );
      return { signal: mapSignal(result.rows[0]), created: false };
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

  async listSignalsForCompetitor(competitorId: string, limit = 8): Promise<IntelSignal[]> {
    const result = await this.pool.query<SignalRow>(
      "SELECT * FROM intel_signals WHERE competitor_id = $1 ORDER BY composite_score DESC, first_seen_at DESC LIMIT $2",
      [competitorId, limit]
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

  async getSetting(key: string): Promise<string | undefined> {
    const result = await this.pool.query<{ value: string }>("SELECT value FROM app_settings WHERE key = $1", [key]);
    return result.rows[0]?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO app_settings (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `,
      [key, value]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
