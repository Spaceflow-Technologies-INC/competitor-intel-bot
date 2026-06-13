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

  it("deletes a competitor and keeps historical signals orphaned", async () => {
    const store = new MemoryStore();
    const competitor = await store.upsertCompetitor({
      name: "ZipSource",
      canonicalDomain: "zipsource.example",
      status: "approved",
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
    await store.recordSignal({
      uniqueKey: "zip-signal",
      signal: {
        id: "signal-zip",
        competitorId: competitor.id,
        candidateId: null,
        signalType: "product_launch",
        claim: "product_launch: ZipSource launches",
        summary: "ZipSource launched a sourcing product.",
        spaceflowImplication: "product_gap",
        suggestedAction: "review_product_gap",
        relevanceScore: 0.8,
        noveltyScore: 1,
        confidenceScore: 0.85,
        impactScore: 0.9,
        compositeScore: 0.88,
        sourceUrls: ["https://zipsource.example/blog"]
      }
    });

    await store.deleteCompetitor(competitor.id);

    await expect(store.listCompetitors()).resolves.toHaveLength(0);
    await expect(store.listEnabledSources()).resolves.toHaveLength(0);
    await expect(store.listUnpostedSignals()).resolves.toMatchObject([{ competitorId: null }]);
  });

  it("stores technical intel config, evidence, and latest technical brief", async () => {
    const store = new MemoryStore();
    const competitor = await store.upsertCompetitor({
      name: "Zip",
      canonicalDomain: "zip.com",
      status: "approved",
      category: "procurement_ai",
      similarityScore: 0.91,
      monitoringPriority: 1
    });

    await store.saveIntelConfig({
      researchDepth: "deep",
      briefAudience: "technical",
      cadence: "weekly",
      categories: ["procurement_ai", "sourcing_automation"],
      sourcePreferences: ["docs", "api_docs", "changelog", "careers"]
    });
    await store.recordEvidenceItems([
      {
        competitorId: competitor.id,
        claimType: "ai_usage",
        label: "RFx generation agent",
        summary: "Zip says its sourcing product converts requirements into supplier-ready RFx packages.",
        stance: "evidence",
        confidence: 0.92,
        sourceUrl: "https://zip.com/products/sourcing",
        sourceType: "product",
        observedAt: "2026-06-13T09:00:00.000Z"
      },
      {
        competitorId: competitor.id,
        claimType: "pipeline_step",
        label: "Supplier response scoring",
        summary: "Likely scoring step inferred from supplier-response evaluation copy.",
        stance: "inference",
        confidence: 0.72,
        sourceUrl: "https://zip.com/products/sourcing",
        sourceType: "product",
        observedAt: "2026-06-13T09:00:00.000Z"
      }
    ]);
    await store.saveTechnicalBrief({
      competitorId: competitor.id,
      title: "Zip technical brief",
      executiveSummary: "Zip is moving from intake orchestration into governed agentic procurement execution.",
      markdown: "Zip technical brief\n\nEvidence-backed analysis.",
      confidence: 0.82,
      evidenceCount: 2,
      unknownCount: 1,
      createdAt: "2026-06-13T09:01:00.000Z"
    });

    await expect(store.getIntelConfig()).resolves.toMatchObject({
      researchDepth: "deep",
      briefAudience: "technical",
      cadence: "weekly",
      sourcePreferences: ["docs", "api_docs", "changelog", "careers"]
    });
    await expect(store.listEvidenceForCompetitor(competitor.id)).resolves.toMatchObject([
      { label: "RFx generation agent", stance: "evidence", confidence: 0.92 },
      { label: "Supplier response scoring", stance: "inference", confidence: 0.72 }
    ]);
    await expect(store.getLatestTechnicalBrief(competitor.id)).resolves.toMatchObject({
      title: "Zip technical brief",
      evidenceCount: 2,
      unknownCount: 1
    });
  });

  it("merges duplicate signals instead of losing additional source URLs", async () => {
    const store = new MemoryStore();
    const baseSignal = {
      id: "signal-1",
      competitorId: null,
      candidateId: null,
      signalType: "product_launch" as const,
      claim: "product_launch: Launch",
      summary: "Launch summary",
      spaceflowImplication: "product_gap" as const,
      suggestedAction: "review_product_gap" as const,
      relevanceScore: 0.8,
      noveltyScore: 1,
      confidenceScore: 0.85,
      impactScore: 0.9,
      compositeScore: 0.88
    };

    await store.recordSignal({ uniqueKey: "same", signal: { ...baseSignal, sourceUrls: ["https://a.example"] } });
    const second = await store.recordSignal({
      uniqueKey: "same",
      signal: { ...baseSignal, id: "signal-2", sourceUrls: ["https://b.example"] }
    });

    expect(second.created).toBe(false);
    expect(second.signal.sourceUrls).toEqual(["https://a.example", "https://b.example"]);
    await expect(store.listUnpostedSignals()).resolves.toMatchObject([
      { sourceUrls: ["https://a.example", "https://b.example"] }
    ]);
  });
});
