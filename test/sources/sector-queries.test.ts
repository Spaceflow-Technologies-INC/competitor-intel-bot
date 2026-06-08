import { describe, expect, it } from "vitest";

import { buildCompetitorSearchPlan } from "../../src/sources/sector-queries.js";
import type { Competitor } from "../../src/types.js";

const competitor: Competitor = {
  id: "competitor-1",
  name: "Coupa",
  canonicalDomain: "coupa.com",
  status: "seeded",
  category: "erp_procurement",
  similarityScore: 0.9,
  monitoringPriority: 1
};

describe("buildCompetitorSearchPlan", () => {
  it("targets Spaceflow's procurement AI sector and high-signal events", () => {
    const plan = buildCompetitorSearchPlan(competitor);

    expect(plan.objective).toContain("procurement AI");
    expect(plan.objective).toContain("sourcing automation");
    expect(plan.objective).toContain("customer wins");
    expect(plan.searchQueries).toContain("Coupa procurement AI");
    expect(plan.searchQueries).toContain("Coupa customer win sourcing");
    expect(plan.searchQueries.length).toBeLessThanOrEqual(5);
  });
});
