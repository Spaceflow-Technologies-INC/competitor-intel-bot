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

  it("rejects unknown categories with usable guidance", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({ store, text: "add wrong.ai WrongBot magic" });

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("Unknown category");
    expect(response.text).toContain("procurement_ai");
  });
});
