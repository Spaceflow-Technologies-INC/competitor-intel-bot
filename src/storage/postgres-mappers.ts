import type { Competitor, IntelSignal } from "../types.js";
import type { SourceRecord } from "./memory-store.js";

export type CompetitorRow = {
  id: string;
  name: string;
  canonical_domain: string;
  status: Competitor["status"];
  category: Competitor["category"];
  similarity_score: number;
  monitoring_priority: number;
};

export type SourceRow = {
  id: string;
  competitor_id: string;
  source_type: string;
  url: string;
  enabled: boolean;
};

export type SignalRow = {
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

export function mapCompetitor(row: CompetitorRow | undefined): Competitor {
  if (!row) throw new Error("Expected competitor row");
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

export function mapSource(row: SourceRow | undefined): SourceRecord {
  if (!row) throw new Error("Expected source row");
  return {
    id: row.id,
    competitorId: row.competitor_id,
    sourceType: row.source_type,
    url: row.url,
    enabled: row.enabled
  };
}

export function mapSignal(row: SignalRow | undefined): IntelSignal {
  if (!row) throw new Error("Expected signal row");
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
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  }
  return [];
}
