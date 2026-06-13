import { describe, expect, it, vi } from "vitest";

import { handleIntelSlashCommand } from "../../src/slack/control.js";
import { MemoryStore } from "../../src/storage/memory-store.js";
import type { Competitor, TechnicalBrief } from "../../src/types.js";

async function seedCompetitor(store: MemoryStore, name = "Zip", domain = "zip.com"): Promise<Competitor> {
  return store.upsertCompetitor({
    name,
    canonicalDomain: domain,
    status: "approved",
    category: "procurement_ai",
    similarityScore: 0.91,
    monitoringPriority: 1
  });
}

function briefFor(competitor: Competitor): TechnicalBrief {
  return {
    competitorId: competitor.id,
    title: `${competitor.name} technical brief`,
    executiveSummary: `${competitor.name} uses evidence-backed procurement AI workflows.`,
    markdown: `*${competitor.name} technical brief*\n\n*Evidence*\n- Evidence: RFx generation agent\n\n*Unknowns*\n- Unknown: Model architecture`,
    confidence: 0.82,
    evidenceCount: 2,
    unknownCount: 1,
    createdAt: "2026-06-13T09:00:00.000Z"
  };
}

describe("Slack technical competitor control", () => {
  it("runs an onboarding wizard and saves technical intel settings", async () => {
    const store = new MemoryStore();

    const intro = await handleIntelSlashCommand({ store, text: "onboard" });
    const updated = await handleIntelSlashCommand({ store, text: "onboard depth deep audience technical cadence weekly" });

    expect(intro.text).toContain("Competitor onboarding");
    expect(updated.text).toContain("Competitor onboarding updated");
    await expect(store.getIntelConfig()).resolves.toMatchObject({
      researchDepth: "deep",
      briefAudience: "technical",
      cadence: "weekly"
    });
  });

  it("renders technical source graph targets from Slack", async () => {
    const store = new MemoryStore();
    await seedCompetitor(store);

    const response = await handleIntelSlashCommand({ store, text: "sources zip.com" });
    const json = JSON.stringify(response.blocks);

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("source graph");
    expect(json).toContain("Product");
    expect(json).toContain("Docs");
  });

  it("runs technical brief and refresh commands through the research dependency", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    const technicalResearch = vi.fn(async () => ({ brief: briefFor(competitor), refreshed: true }));

    const response = await handleIntelSlashCommand({ store, text: "tech zip.com", technicalResearch });
    const refresh = await handleIntelSlashCommand({ store, text: "refresh zip.com", technicalResearch });

    expect(response.text).toContain("Zip technical brief");
    expect(JSON.stringify(response.blocks)).toContain("RFx generation agent");
    expect(refresh.text).toContain("refreshed");
    expect(technicalResearch).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: false }));
    expect(technicalResearch).toHaveBeenCalledWith(expect.objectContaining({ forceRefresh: true }));
  });

  it("renders evidence and unknowns from stored technical claims", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    await store.recordEvidenceItems([
      {
        competitorId: competitor.id,
        claimType: "ai_usage",
        label: "RFx generation agent",
        summary: "Public product copy describes RFx generation.",
        stance: "evidence",
        confidence: 0.92,
        sourceUrl: "https://zip.com/products/sourcing",
        sourceType: "product",
        observedAt: "2026-06-13T09:00:00.000Z"
      },
      {
        competitorId: competitor.id,
        claimType: "unknown",
        label: "Model architecture",
        summary: "No public evidence found for model architecture.",
        stance: "unknown",
        confidence: 0.4,
        sourceUrl: "https://zip.com",
        sourceType: "homepage",
        observedAt: "2026-06-13T09:00:00.000Z"
      }
    ]);

    const evidence = await handleIntelSlashCommand({ store, text: "evidence zip.com ai_usage" });
    const unknowns = await handleIntelSlashCommand({ store, text: "unknowns zip.com" });

    expect(JSON.stringify(evidence.blocks)).toContain("RFx generation agent");
    expect(JSON.stringify(unknowns.blocks)).toContain("Model architecture");
  });

  it("compares two competitors using technical research summaries", async () => {
    const store = new MemoryStore();
    const zip = await seedCompetitor(store, "Zip", "zip.com");
    const coupa = await seedCompetitor(store, "Coupa", "coupa.com");
    const technicalResearch = vi.fn(async ({ competitor }: { competitor: Competitor }) => ({
      brief: briefFor(competitor.id === zip.id ? zip : coupa),
      refreshed: false
    }));

    const response = await handleIntelSlashCommand({ store, text: "compare zip.com coupa.com", technicalResearch });
    const json = JSON.stringify(response.blocks);

    expect(response.text).toContain("Technical comparison");
    expect(json).toContain("Zip");
    expect(json).toContain("Coupa");
    expect(json).toContain("evidence-backed procurement AI workflows");
  });
});
