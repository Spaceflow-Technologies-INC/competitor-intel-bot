import { describe, expect, it } from "vitest";

import { collectIntel } from "../../src/jobs/run-collection.js";
import { MemoryStore } from "../../src/storage/memory-store.js";

const seeds = [
  { name: "Coupa", domain: "coupa.com", category: "erp_procurement" as const }
];

const sourceClient = {
  search: async () => [
    {
      url: "https://coupa.com/news/acme",
      title: "Acme selects Coupa AI sourcing",
      publishDate: "2026-06-08",
      excerpts: ["Acme selected Coupa for AI sourcing automation and supplier onboarding."]
    }
  ],
  extract: async () => [
    {
      url: "https://coupa.com/news/acme",
      title: "Acme selects Coupa AI sourcing",
      excerpts: ["Coupa launched supplier onboarding AI agents with Acme as a new enterprise customer."]
    }
  ]
};

describe("collectIntel", () => {
  it("collects source-backed high-signal intel and deduplicates repeat runs", async () => {
    const store = new MemoryStore();

    const first = await collectIntel({
      store,
      seeds,
      sourceClient,
      fetchedAt: "2026-06-09T06:00:00.000Z",
      alertThreshold: 0.75
    });

    expect(first.processedSignals).toBeGreaterThanOrEqual(2);
    expect(first.storedSignals).toBeGreaterThanOrEqual(1);
    expect(first.postedSignals).toBe(0);
    await expect(store.listUnpostedSignals()).resolves.toHaveLength(first.storedSignals);

    const second = await collectIntel({
      store,
      seeds,
      sourceClient,
      fetchedAt: "2026-06-09T06:05:00.000Z",
      alertThreshold: 0.75
    });

    expect(second.storedSignals).toBe(0);
  });

  it("skips archived competitors during collection", async () => {
    const store = new MemoryStore();
    await store.upsertCompetitor({
      name: "Archived",
      canonicalDomain: "archived.example",
      status: "archived",
      category: "procurement_ai",
      similarityScore: 0.82,
      monitoringPriority: 1
    });

    const result = await collectIntel({
      store,
      seeds: [],
      sourceClient,
      fetchedAt: "2026-06-09T06:00:00.000Z",
      alertThreshold: 0.75
    });

    expect(result).toEqual({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 });
  });
});
