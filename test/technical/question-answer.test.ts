import { describe, expect, it, vi } from "vitest";

import { DeterministicQuestionAnswerer, answerCompetitorQuestion } from "../../src/technical/question-answer.js";
import { MemoryStore } from "../../src/storage/memory-store.js";
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

describe("answerCompetitorQuestion", () => {
  it("combines stored intel with question-specific Parallel research", async () => {
    const store = new MemoryStore();
    const storedCompetitor = await store.upsertCompetitor({
      name: competitor.name,
      canonicalDomain: competitor.canonicalDomain,
      status: competitor.status,
      category: competitor.category,
      similarityScore: competitor.similarityScore,
      monitoringPriority: competitor.monitoringPriority
    });
    await store.upsertSource({
      competitorId: storedCompetitor.id,
      sourceType: "product",
      url: "https://ziphq.com/product/intake",
      enabled: true
    });
    await store.recordEvidenceItems([
      { ...evidence[0]!, competitorId: storedCompetitor.id },
      { ...evidence[1]!, competitorId: storedCompetitor.id }
    ]);
    const search = vi.fn(async (_input: { objective: string; searchQueries: string[] }) => [{
        url: "https://ziphq.com/blog/ai-procurement",
        title: "Zip AI procurement",
        excerpts: ["Zip uses AI to classify procurement intake and suggest approvers."]
      }]);
    const extract = vi.fn(async (_input: { urls: string[]; objective: string; searchQueries?: string[] }) => [{
        url: "https://ziphq.com/blog/ai-procurement",
        title: "Zip AI procurement",
        excerpts: ["AI classifies requests and routes approvals based on procurement context."]
      }]);
    const sourceClient = { search, extract };
    const answerer = {
      answer: vi.fn(async (input) => new DeterministicQuestionAnswerer().answer(input))
    };

    const answer = await answerCompetitorQuestion({
      store,
      competitor: storedCompetitor,
      question: "How does Zip use AI in intake approvals?",
      sourceClient,
      answerer,
      now: "2026-06-13T10:00:00.000Z"
    });

    expect(search).toHaveBeenCalledWith(expect.objectContaining({
      objective: expect.stringContaining("How does Zip use AI in intake approvals?")
    }));
    expect(extract.mock.calls[0]?.[0].urls).toEqual(expect.arrayContaining([
      "https://ziphq.com/product/intake",
      "https://ziphq.com/blog/ai-procurement"
    ]));
    expect(answerer.answer).toHaveBeenCalledWith(expect.objectContaining({
      evidence: expect.arrayContaining([expect.objectContaining({ label: "AI intake classification" })]),
      pages: expect.arrayContaining([expect.objectContaining({ title: "Zip AI procurement" })])
    }));
    expect(answer.shortAnswer).toContain("Zip");
  });
});
