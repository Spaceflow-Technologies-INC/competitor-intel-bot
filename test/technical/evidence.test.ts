import { describe, expect, it } from "vitest";

import { extractTechnicalEvidence } from "../../src/technical/evidence.js";
import type { Competitor } from "../../src/types.js";

const competitor: Competitor = {
  id: "competitor-1",
  name: "Zip",
  canonicalDomain: "zip.com",
  status: "approved",
  category: "procurement_ai",
  similarityScore: 0.91,
  monitoringPriority: 1
};

describe("technical evidence extraction", () => {
  it("separates public evidence, pipeline inference, and unknown technical claims", () => {
    const evidence = extractTechnicalEvidence({
      competitor,
      fetchedAt: "2026-06-13T09:00:00.000Z",
      pages: [
        {
          url: "https://zip.com/products/sourcing",
          title: "Sourcing",
          excerpts: [],
          fullContent: [
            "Scale sourcing impact with purpose-built AI agents.",
            "RFx generation agent converts requirements and survey inputs into structured, supplier-ready RFx packages.",
            "Competitive research agent analyzes suppliers, finds competitors, and surfaces market insights.",
            "AI-powered vendor evaluation and scoring scores and compares supplier responses.",
            "Pipeline creation creates sourcing projects with defined scope, owners, timelines, and savings targets."
          ].join("\n")
        }
      ]
    });

    expect(evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ claimType: "ai_usage", label: "RFx generation agent", stance: "evidence" }),
        expect.objectContaining({ claimType: "feature", label: "Vendor evaluation and scoring", stance: "evidence" }),
        expect.objectContaining({ claimType: "pipeline_step", label: "Sourcing project pipeline creation", stance: "evidence" }),
        expect.objectContaining({ claimType: "pipeline_step", label: "Intake to RFx workflow", stance: "inference" }),
        expect.objectContaining({ claimType: "unknown", label: "Model architecture", stance: "unknown" })
      ])
    );
  });
});
