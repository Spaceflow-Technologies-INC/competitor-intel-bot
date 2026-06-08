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
