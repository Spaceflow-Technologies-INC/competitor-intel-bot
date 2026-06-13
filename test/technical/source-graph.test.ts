import { describe, expect, it } from "vitest";

import { buildTechnicalSourcePlan } from "../../src/technical/source-graph.js";
import type { Competitor, IntelConfig } from "../../src/types.js";

const competitor: Competitor = {
  id: "competitor-1",
  name: "Zip",
  canonicalDomain: "zip.com",
  status: "approved",
  category: "procurement_ai",
  similarityScore: 0.91,
  monitoringPriority: 1
};

const baseConfig: IntelConfig = {
  researchDepth: "standard",
  briefAudience: "technical",
  cadence: "weekly",
  categories: ["procurement_ai"],
  sourcePreferences: ["homepage", "product", "docs", "api_docs", "changelog", "integrations", "security", "careers", "reviews", "news"]
};

describe("technical source graph", () => {
  it("builds a focused light plan for product and AI positioning", () => {
    const plan = buildTechnicalSourcePlan({ competitor, config: { ...baseConfig, researchDepth: "light" } });

    expect(plan.targets.map((target) => target.sourceType)).toEqual(["homepage", "product", "news"]);
    expect(plan.searchQueries.join(" ")).toContain("Zip AI procurement workflow pipeline");
    expect(plan.objective).toContain("technical competitor intelligence");
  });

  it("adds official docs, integrations, security, careers, reviews, and changelog in standard mode", () => {
    const plan = buildTechnicalSourcePlan({ competitor, config: baseConfig });

    expect(plan.targets.map((target) => target.sourceType)).toEqual(
      expect.arrayContaining(["docs", "integrations", "security", "careers", "reviews", "changelog"])
    );
    expect(plan.searchQueries).toEqual(
      expect.arrayContaining([
        "Zip API docs integrations procurement",
        "Zip careers AI procurement engineering agent"
      ])
    );
  });

  it("adds deep technical sources for API, technographics, webinars, social, and pricing", () => {
    const plan = buildTechnicalSourcePlan({ competitor, config: { ...baseConfig, researchDepth: "deep" } });

    expect(plan.targets.map((target) => target.sourceType)).toEqual(
      expect.arrayContaining(["api_docs", "technographics", "webinar", "social", "pricing"])
    );
    expect(plan.searchQueries.join(" ")).toContain("Zip governed autonomy audit permissions");
  });
});
