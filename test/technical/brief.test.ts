import { describe, expect, it } from "vitest";

import { buildDeterministicTechnicalBrief } from "../../src/technical/brief.js";
import type { Competitor, TechnicalEvidenceItem } from "../../src/types.js";

const competitor: Competitor = {
  id: "competitor-1",
  name: "Zip",
  canonicalDomain: "zip.com",
  status: "approved",
  category: "procurement_ai",
  similarityScore: 0.91,
  monitoringPriority: 1
};

const evidence: TechnicalEvidenceItem[] = [
  {
    competitorId: competitor.id,
    claimType: "ai_usage",
    label: "RFx generation agent",
    summary: "Public product copy says Zip converts requirements into supplier-ready RFx packages.",
    stance: "evidence",
    confidence: 0.92,
    sourceUrl: "https://zip.com/products/sourcing",
    sourceType: "product",
    observedAt: "2026-06-13T09:00:00.000Z"
  },
  {
    competitorId: competitor.id,
    claimType: "pipeline_step",
    label: "Intake to RFx workflow",
    summary: "Likely workflow from intake requirements to RFx generation and supplier response scoring.",
    stance: "inference",
    confidence: 0.74,
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
];

describe("technical brief synthesis", () => {
  it("builds a source-backed technical brief with evidence, inference, and unknown sections", () => {
    const brief = buildDeterministicTechnicalBrief({
      competitor,
      evidence,
      createdAt: "2026-06-13T09:01:00.000Z"
    });

    expect(brief.title).toBe("Zip technical brief");
    expect(brief.executiveSummary).toContain("evidence-backed");
    expect(brief.markdown).toContain("What they do technically");
    expect(brief.markdown).toContain("Evidence");
    expect(brief.markdown).toContain("Inference");
    expect(brief.markdown).toContain("Unknowns");
    expect(brief.markdown).toContain("Spaceflow counter-positioning");
    expect(brief.evidenceCount).toBe(2);
    expect(brief.unknownCount).toBe(1);
  });
});
