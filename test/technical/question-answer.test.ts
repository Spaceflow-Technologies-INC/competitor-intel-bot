import { describe, expect, it } from "vitest";

import { DeterministicQuestionAnswerer } from "../../src/technical/question-answer.js";
import type { Competitor, TechnicalEvidenceItem } from "../../src/types.js";

const competitor: Competitor = {
  id: "zip-id",
  name: "Zip",
  canonicalDomain: "ziphq.com",
  status: "approved",
  category: "procurement_ai",
  similarityScore: 0.91,
  monitoringPriority: 1
};

const evidence: TechnicalEvidenceItem[] = [
  {
    competitorId: competitor.id,
    claimType: "ai_usage",
    label: "AI intake classification",
    summary: "Zip product copy describes AI that classifies procurement intake and routes requests.",
    stance: "evidence",
    confidence: 0.9,
    sourceUrl: "https://ziphq.com/product/intake",
    sourceType: "product",
    observedAt: "2026-06-13T09:00:00.000Z"
  },
  {
    competitorId: competitor.id,
    claimType: "unknown",
    label: "Model architecture",
    summary: "No public evidence found for Zip's model architecture.",
    stance: "unknown",
    confidence: 0.4,
    sourceUrl: "https://ziphq.com",
    sourceType: "homepage",
    observedAt: "2026-06-13T09:00:00.000Z"
  }
];

describe("DeterministicQuestionAnswerer", () => {
  it("answers competitor questions with evidence, inference, unknowns, and citations", async () => {
    const answerer = new DeterministicQuestionAnswerer();

    const answer = await answerer.answer({
      competitor,
      question: "How does Zip use AI in procurement intake?",
      evidence,
      signals: [],
      pages: [
        {
          url: "https://ziphq.com/product/intake",
          title: "Zip Intake",
          excerpts: ["AI classifies procurement requests, identifies stakeholders, and routes approval workflows."]
        }
      ],
      createdAt: "2026-06-13T10:00:00.000Z"
    });

    expect(answer.shortAnswer).toContain("Zip");
    expect(answer.evidence.map((item) => item.label)).toContain("AI intake classification");
    expect(answer.inferences[0]?.summary).toContain("intake");
    expect(answer.unknowns.map((item) => item.label)).toContain("Model architecture");
    expect(answer.citations).toContainEqual(
      expect.objectContaining({
        title: "Zip Intake",
        url: "https://ziphq.com/product/intake"
      })
    );
    expect(answer.confidence).toBeGreaterThan(0.5);
  });
});
