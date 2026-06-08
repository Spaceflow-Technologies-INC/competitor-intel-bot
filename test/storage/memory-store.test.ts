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
});
