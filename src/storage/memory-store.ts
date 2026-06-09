import { randomUUID } from "node:crypto";

import type { Competitor, CompetitorCategory, CompetitorStatus, IntelSignal, SignalType } from "../types.js";

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

export type RecordSignalInput = {
  signal: IntelSignal;
  uniqueKey: string;
};

export type RecordSignalResult = {
  signal: IntelSignal;
  created: boolean;
};

export interface Store {
  upsertCompetitor(input: UpsertCompetitorInput): Promise<Competitor>;
  listCompetitors(): Promise<Competitor[]>;
  updateCompetitorStatus(input: { id: string; status: CompetitorStatus }): Promise<Competitor>;
  upsertSource(input: UpsertSourceInput): Promise<SourceRecord>;
  listEnabledSources(): Promise<SourceRecord[]>;
  listSourcesForCompetitor(competitorId: string): Promise<SourceRecord[]>;
  recordSignal(input: RecordSignalInput): Promise<RecordSignalResult>;
  listUnpostedSignals(limit?: number): Promise<IntelSignal[]>;
  listSignalsForCompetitor(competitorId: string, limit?: number): Promise<IntelSignal[]>;
  markSignalsPosted(ids: string[]): Promise<void>;
  countSimilarSignals(input: { competitorId: string | null; signalType: SignalType }): Promise<number>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}

export class MemoryStore implements Store {
  private readonly competitors = new Map<string, Competitor>();
  private readonly sources = new Map<string, SourceRecord>();
  private readonly signals = new Map<string, IntelSignal>();
  private readonly signalKeys = new Map<string, string>();
  private readonly postedSignalIds = new Set<string>();
  private readonly settings = new Map<string, string>();

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

  async updateCompetitorStatus(input: { id: string; status: CompetitorStatus }): Promise<Competitor> {
    const existing = this.competitors.get(input.id);
    if (!existing) {
      throw new Error(`Competitor not found: ${input.id}`);
    }
    const competitor = { ...existing, status: input.status };
    this.competitors.set(competitor.id, competitor);
    return { ...competitor };
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

  async listSourcesForCompetitor(competitorId: string): Promise<SourceRecord[]> {
    return [...this.sources.values()]
      .filter((source) => source.competitorId === competitorId)
      .map((source) => ({ ...source }));
  }

  async recordSignal(input: RecordSignalInput): Promise<RecordSignalResult> {
    const existingId = this.signalKeys.get(input.uniqueKey);
    if (existingId) {
      const existing = this.signals.get(existingId);
      if (!existing) {
        throw new Error("Expected signal row");
      }
      const merged = {
        ...existing,
        sourceUrls: [...new Set([...existing.sourceUrls, ...input.signal.sourceUrls])],
        confidenceScore: Math.max(existing.confidenceScore, input.signal.confidenceScore),
        compositeScore: Math.max(existing.compositeScore, input.signal.compositeScore)
      };
      this.signals.set(existing.id, merged);
      return { signal: { ...merged, sourceUrls: [...merged.sourceUrls] }, created: false };
    }
    this.signalKeys.set(input.uniqueKey, input.signal.id);
    this.signals.set(input.signal.id, { ...input.signal, sourceUrls: [...input.signal.sourceUrls] });
    return { signal: { ...input.signal, sourceUrls: [...input.signal.sourceUrls] }, created: true };
  }

  async listUnpostedSignals(limit = 10): Promise<IntelSignal[]> {
    return [...this.signals.values()]
      .filter((signal) => !this.postedSignalIds.has(signal.id))
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit)
      .map((signal) => ({ ...signal, sourceUrls: [...signal.sourceUrls] }));
  }

  async listSignalsForCompetitor(competitorId: string, limit = 8): Promise<IntelSignal[]> {
    return [...this.signals.values()]
      .filter((signal) => signal.competitorId === competitorId)
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit)
      .map((signal) => ({ ...signal, sourceUrls: [...signal.sourceUrls] }));
  }

  async markSignalsPosted(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.postedSignalIds.add(id);
    }
  }

  async countSimilarSignals(input: { competitorId: string | null; signalType: SignalType }): Promise<number> {
    return [...this.signals.values()].filter(
      (signal) => signal.competitorId === input.competitorId && signal.signalType === input.signalType
    ).length;
  }

  async getSetting(key: string): Promise<string | undefined> {
    return this.settings.get(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }
}
