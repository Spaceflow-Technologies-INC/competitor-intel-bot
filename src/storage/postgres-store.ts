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
