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

  it("deletes a competitor from Slack when it should be fully removed", async () => {
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

    const response = await handleIntelSlashCommand({ store, text: "delete coupa.com", userName: "ceo" });

    expect(response.response_type).toBe("in_channel");
    expect(response.text).toContain("deleted");
    await expect(store.listCompetitors()).resolves.toHaveLength(0);
    await expect(store.listEnabledSources()).resolves.toHaveLength(0);
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

  it("discovers a candidate competitor from a plain company name before approval", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({
      store,
      text: 'add "Acme Sourcing"',
      userName: "ceo",
      discoverCompetitor: async () => ({
        name: "Acme Sourcing",
        canonicalDomain: "acmesourcing.ai",
        category: "sourcing_automation",
        confidence: 0.81,
        evidenceUrls: ["https://acmesourcing.ai", "https://www.linkedin.com/company/acme-sourcing"]
      })
    });

    expect(response.response_type).toBe("in_channel");
    expect(response.text).toContain("waiting for competitor monitoring approval");
    expect(JSON.stringify(response.blocks)).toContain("acmesourcing.ai");
    expect(JSON.stringify(response.blocks)).toContain("Approve");
    expect(await store.listCompetitors()).toMatchObject([
      {
        name: "Acme Sourcing",
        canonicalDomain: "acmesourcing.ai",
        status: "candidate",
        category: "sourcing_automation"
      }
    ]);
  });

  it("discovers a candidate competitor from a LinkedIn company URL", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({
      store,
      text: "suggest https://www.linkedin.com/company/acme-sourcing/",
      discoverCompetitor: async (query) => ({
        name: "Acme Sourcing",
        canonicalDomain: "acmesourcing.ai",
        category: "sourcing_automation",
        confidence: 0.78,
        evidenceUrls: [query.rawQuery, "https://acmesourcing.ai"]
      })
    });

    expect(response.text).toContain("Acme Sourcing");
    await expect(store.listCompetitors()).resolves.toMatchObject([
      {
        canonicalDomain: "acmesourcing.ai",
        status: "candidate"
      }
    ]);
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
    expect(json).toContain("Delete");
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

  it("uses the /competitor command name in operator guidance", async () => {
    const store = new MemoryStore();

    const help = await handleIntelSlashCommand({ store, text: "help" });
    const invalidSchedule = await handleIntelSlashCommand({ store, text: "schedule bad" });
    const guidance = `${JSON.stringify(help.blocks)} ${JSON.stringify(invalidSchedule.blocks)} ${invalidSchedule.text}`;

    expect(guidance).toContain("/competitor list");
    expect(guidance).toContain("/competitor schedule 08:30");
    expect(guidance).not.toContain("/intel");
  });

  it("rejects unknown categories with usable guidance", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({
      store,
      text: "add wrong.ai WrongBot magic",
      discoverCompetitor: async () => {
        throw new Error("Discovery should not run for direct-domain unknown category errors");
      }
    });

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("Unknown category");
    expect(response.text).toContain("procurement_ai");
  });
});
