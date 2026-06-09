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
