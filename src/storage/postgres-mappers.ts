import type { Competitor, IntelConfig, IntelSignal, TechnicalBrief, TechnicalEvidenceItem } from "../types.js";
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

export type IntelConfigRow = {
  key: string;
  value: unknown;
};

export type EvidenceRow = {
  id: string;
  competitor_id: string;
  claim_type: TechnicalEvidenceItem["claimType"];
  label: string;
  summary: string;
  stance: TechnicalEvidenceItem["stance"];
  confidence: number;
  source_url: string;
  source_type: TechnicalEvidenceItem["sourceType"];
  observed_at: string | Date;
};

export type TechnicalBriefRow = {
  id: string;
  competitor_id: string;
  title: string;
  executive_summary: string;
  markdown: string;
  confidence: number;
  evidence_count: number;
  unknown_count: number;
  created_at: string | Date;
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

export function mapIntelConfig(row: IntelConfigRow | undefined, fallback: IntelConfig): IntelConfig {
  if (!row) return cloneIntelConfig(fallback);
  const value = typeof row.value === "string" ? JSON.parse(row.value) as unknown : row.value;
  if (!isRecord(value)) return cloneIntelConfig(fallback);
  return {
    researchDepth: stringValue(value.researchDepth, fallback.researchDepth) as IntelConfig["researchDepth"],
    briefAudience: stringValue(value.briefAudience, fallback.briefAudience) as IntelConfig["briefAudience"],
    cadence: stringValue(value.cadence, fallback.cadence) as IntelConfig["cadence"],
    categories: stringArray(value.categories, fallback.categories) as IntelConfig["categories"],
    sourcePreferences: stringArray(value.sourcePreferences, fallback.sourcePreferences) as IntelConfig["sourcePreferences"]
  };
}

export function mapEvidence(row: EvidenceRow | undefined): TechnicalEvidenceItem {
  if (!row) throw new Error("Expected evidence row");
  return {
    id: row.id,
    competitorId: row.competitor_id,
    claimType: row.claim_type,
    label: row.label,
    summary: row.summary,
    stance: row.stance,
    confidence: row.confidence,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    observedAt: dateString(row.observed_at)
  };
}

export function mapTechnicalBrief(row: TechnicalBriefRow | undefined): TechnicalBrief {
  if (!row) throw new Error("Expected technical brief row");
  return {
    id: row.id,
    competitorId: row.competitor_id,
    title: row.title,
    executiveSummary: row.executive_summary,
    markdown: row.markdown,
    confidence: row.confidence,
    evidenceCount: row.evidence_count,
    unknownCount: row.unknown_count,
    createdAt: dateString(row.created_at)
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

function cloneIntelConfig(config: IntelConfig): IntelConfig {
  return {
    ...config,
    categories: [...config.categories],
    sourcePreferences: [...config.sourcePreferences]
  };
}

function dateString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [...fallback];
}
