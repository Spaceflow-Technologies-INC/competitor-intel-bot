import { describe, expect, it } from "vitest";

import { buildSeedSources } from "../../src/competitors/seed.js";

describe("buildSeedSources", () => {
  it("creates default source URLs for a seed competitor", () => {
    const sources = buildSeedSources({
      name: "ZipSource",
      domain: "zipsource.example",
      category: "procurement_ai"
    });

    expect(sources).toEqual([
      { sourceType: "homepage", url: "https://zipsource.example" },
      { sourceType: "blog", url: "https://zipsource.example/blog" },
      { sourceType: "pricing", url: "https://zipsource.example/pricing" },
      { sourceType: "careers", url: "https://zipsource.example/careers" }
    ]);
  });
});
