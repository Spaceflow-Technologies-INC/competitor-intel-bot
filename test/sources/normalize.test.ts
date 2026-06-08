import { describe, expect, it } from "vitest";

import { normalizeSnapshot } from "../../src/sources/normalize.js";

describe("normalizeSnapshot", () => {
  it("creates stable hashes and trimmed excerpts", () => {
    const snapshot = normalizeSnapshot({
      sourceId: "source-1",
      url: "https://zipsource.example/blog/launch",
      title: "  Supplier Agent Launch  ",
      body: "ZipSource launched a supplier onboarding agent for enterprise procurement teams.",
      fetchedAt: "2026-06-09T00:00:00.000Z"
    });

    expect(snapshot.title).toBe("Supplier Agent Launch");
    expect(snapshot.bodyExcerpt).toContain("supplier onboarding agent");
    expect(snapshot.rawHash).toHaveLength(64);
    expect(snapshot.contentHash).toHaveLength(64);
  });
});
