import { describe, expect, it, vi } from "vitest";

import { handleIntelSlashCommand } from "../../src/slack/control.js";
import { MemoryStore } from "../../src/storage/memory-store.js";

describe("Slack intel control", () => {
  it("adds a competitor from a slash command", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({
      store,
      text: 'add "SAP Ariba" ariba.com erp_procurement',
      userName: "orçun"
    });

    expect(response.response_type).toBe("in_channel");
    expect(response.text).toContain("SAP Ariba");
    await expect(store.listCompetitors()).resolves.toMatchObject([
      {
        name: "SAP Ariba",
        canonicalDomain: "ariba.com",
        status: "approved",
        category: "erp_procurement"
      }
    ]);
    const sources = await store.listEnabledSources();
    expect(sources).toHaveLength(4);
    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "homepage",
          url: "https://ariba.com",
          enabled: true
        })
      ])
    );
  });

  it("renders active competitors in Slack-friendly fields", async () => {
    const store = new MemoryStore();
    await store.upsertCompetitor({
      name: "Coupa",
      canonicalDomain: "coupa.com",
      status: "approved",
      category: "procurement_ai",
      similarityScore: 0.82,
      monitoringPriority: 1
    });

    const response = await handleIntelSlashCommand({ store, text: "list" });

    expect(response.response_type).toBe("ephemeral");
    expect(JSON.stringify(response.blocks)).toContain("coupa.com");
    expect(JSON.stringify(response.blocks)).toContain("procurement_ai");
  });

  it("archives a competitor so it can be removed from monitoring without deleting history", async () => {
    const store = new MemoryStore();
    await store.upsertCompetitor({
      name: "Coupa",
      canonicalDomain: "coupa.com",
      status: "approved",
      category: "procurement_ai",
      similarityScore: 0.82,
      monitoringPriority: 1
    });

    const response = await handleIntelSlashCommand({ store, text: "archive coupa.com", userName: "ceo" });

    expect(response.response_type).toBe("in_channel");
    expect(response.text).toContain("archived");
    await expect(store.listCompetitors()).resolves.toMatchObject([{ status: "archived" }]);
  });

  it("starts a manual digest run without waiting for the scan to finish", async () => {
    const store = new MemoryStore();
    const triggerDigest = vi.fn(async () => ({ postedSignals: 0 }));

    const response = await handleIntelSlashCommand({ store, text: "run now", triggerDigest });

    expect(response.response_type).toBe("in_channel");
    expect(response.text).toContain("Manual intel run started");
    expect(triggerDigest).toHaveBeenCalledTimes(1);
  });

  it("creates candidate competitors and approves them through Slack commands", async () => {
    const store = new MemoryStore();

    const suggested = await handleIntelSlashCommand({
      store,
      text: 'suggest "NewCo AI" newco.ai sourcing_automation',
      userName: "cfo"
    });
    const pending = await store.listCompetitors();

    expect(suggested.response_type).toBe("in_channel");
    expect(JSON.stringify(suggested.blocks)).toContain("Approve");
    expect(pending).toMatchObject([{ canonicalDomain: "newco.ai", status: "candidate" }]);

    const approved = await handleIntelSlashCommand({ store, text: "approve newco.ai", userName: "ceo" });

    expect(approved.response_type).toBe("in_channel");
    await expect(store.listCompetitors()).resolves.toMatchObject([{ canonicalDomain: "newco.ai", status: "approved" }]);
  });

  it("renders a readable battlecard for one competitor", async () => {
    const store = new MemoryStore();
    const competitor = await store.upsertCompetitor({
      name: "Coupa",
      canonicalDomain: "coupa.com",
      status: "approved",
      category: "procurement_ai",
      similarityScore: 0.82,
      monitoringPriority: 1
    });
    await store.upsertSource({
      competitorId: competitor.id,
      sourceType: "homepage",
      url: "https://coupa.com",
      enabled: true
    });
    await store.recordSignal({
      uniqueKey: "signal-key",
      signal: {
        id: "signal-1",
        competitorId: competitor.id,
        candidateId: null,
        signalType: "pricing_change",
        claim: "pricing_change: Coupa introduces AI procurement pricing",
        summary: "Coupa introduced AI pricing packages for procurement teams.",
        spaceflowImplication: "positioning",
        suggestedAction: "update_battlecard",
        relevanceScore: 0.9,
        noveltyScore: 0.9,
        confidenceScore: 0.95,
        impactScore: 0.85,
        compositeScore: 0.9,
        sourceUrls: ["https://coupa.com/pricing"]
      }
    });

    const response = await handleIntelSlashCommand({ store, text: "show coupa.com" });
    const json = JSON.stringify(response.blocks);

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("Coupa battlecard");
    expect(json).toContain("Battlecard");
    expect(json).toContain("Pricing change");
    expect(json).toContain("update battlecard");
    expect(json).toContain("Official");
  });

  it("shows and updates the digest schedule from Slack", async () => {
    const store = new MemoryStore();

    const updated = await handleIntelSlashCommand({ store, text: "schedule 08:30" });
    const shown = await handleIntelSlashCommand({ store, text: "schedule" });

    expect(updated.response_type).toBe("in_channel");
    expect(updated.text).toContain("08:30");
    expect(shown.text).toContain("08:30");
    await expect(store.getSetting("daily_digest_time")).resolves.toBe("08:30");
  });

  it("rejects unknown categories with usable guidance", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({ store, text: "add wrong.ai WrongBot magic" });

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("Unknown category");
    expect(response.text).toContain("procurement_ai");
  });
});
