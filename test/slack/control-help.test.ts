import { describe, expect, it } from "vitest";

import { handleIntelSlashCommand } from "../../src/slack/control.js";
import { MemoryStore } from "../../src/storage/memory-store.js";

describe("Slack intel control help", () => {
  it("renders a readable two-column command center with ask guidance", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({ store, text: "help" });
    const json = JSON.stringify(response.blocks);

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("Competitor Intel commands");
    expect(response.text).toContain("/competitor ask");
    expect(response.blocks.some((block) => "fields" in block)).toBe(true);
    expect(json).toContain("View intel");
    expect(json).toContain("Add competitors");
    expect(json).toContain("Approvals");
    expect(json).toContain("Operations");
    expect(json).toContain("Categories");
    expect(json).not.toContain("/competitor run nowCategories");
  });

  it("accepts Slack link-wrapped domains in control commands", async () => {
    const store = new MemoryStore();

    await handleIntelSlashCommand({
      store,
      text: "add <http://coupa.com|coupa.com> Coupa procurement_ai"
    });
    const shown = await handleIntelSlashCommand({ store, text: "show <http://coupa.com|coupa.com>" });
    const deleted = await handleIntelSlashCommand({ store, text: "delete <http://coupa.com|coupa.com>" });

    expect(shown.text).toContain("Coupa battlecard");
    expect(deleted.text).toContain("Coupa deleted");
    await expect(store.listCompetitors()).resolves.toHaveLength(0);
  });
});
