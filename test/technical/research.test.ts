import { describe, expect, it, vi } from "vitest";

import { researchTechnicalBrief } from "../../src/technical/research.js";
import { MemoryStore } from "../../src/storage/memory-store.js";
import type { WebIntelClient } from "../../src/sources/parallel-client.js";
import type { Competitor } from "../../src/types.js";

async function seedCompetitor(store: MemoryStore): Promise<Competitor> {
  return store.upsertCompetitor({
    name: "Zip",
    canonicalDomain: "zip.com",
    status: "approved",
    category: "procurement_ai",
    similarityScore: 0.91,
    monitoringPriority: 1
  });
}

describe("technical research orchestration", () => {
  it("refreshes technical evidence and stores a latest brief", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    const sourceClient: WebIntelClient = {
      search: vi.fn(async () => [
        {
          url: "https://zip.com/products/sourcing",
          title: "Sourcing",
          excerpts: ["RFx generation agent converts requirements into supplier-ready RFx packages."]
        }
      ]),
      extract: vi.fn(async () => [
        {
          url: "https://zip.com/products/sourcing",
          title: "Sourcing",
          excerpts: [],
          fullContent: "RFx generation agent converts requirements. AI-powered vendor evaluation and scoring scores supplier responses."
        }
      ])
    };

    const result = await researchTechnicalBrief({
      store,
      competitor,
      sourceClient,
      forceRefresh: true,
      now: "2026-06-13T09:00:00.000Z"
    });

    expect(result.refreshed).toBe(true);
    expect(result.brief.markdown).toContain("How they leverage AI");
    expect(await store.listEvidenceForCompetitor(competitor.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "RFx generation agent" })])
    );
    await expect(store.getLatestTechnicalBrief(competitor.id)).resolves.toMatchObject({
      title: "Zip technical brief"
    });
  });

  it("returns cached latest brief without calling the source client when refresh is not forced", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    await store.saveTechnicalBrief({
      competitorId: competitor.id,
      title: "Cached Zip brief",
      executiveSummary: "Cached",
      markdown: "Cached brief",
      confidence: 0.7,
      evidenceCount: 1,
      unknownCount: 1,
      createdAt: "2026-06-13T08:00:00.000Z"
    });
    const sourceClient: WebIntelClient = {
      search: vi.fn(async () => {
        throw new Error("search should not run");
      }),
      extract: vi.fn(async () => [])
    };

    const result = await researchTechnicalBrief({
      store,
      competitor,
      sourceClient,
      forceRefresh: false,
      now: "2026-06-13T09:00:00.000Z"
    });

    expect(result.refreshed).toBe(false);
    expect(result.brief.title).toBe("Cached Zip brief");
    expect(sourceClient.search).not.toHaveBeenCalled();
  });
});
