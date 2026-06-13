import { describe, expect, it, vi } from "vitest";

import { handleIntelSlashCommand } from "../../src/slack/control.js";
import { MemoryStore } from "../../src/storage/memory-store.js";
import type { Competitor, CompetitorQuestionAnswer } from "../../src/types.js";

async function seedCompetitor(store: MemoryStore): Promise<Competitor> {
  return store.upsertCompetitor({
    name: "Zip",
    canonicalDomain: "ziphq.com",
    status: "approved",
    category: "procurement_ai",
    similarityScore: 0.91,
    monitoringPriority: 1
  });
}

function answerFor(competitor: Competitor): CompetitorQuestionAnswer {
  return {
    competitorId: competitor.id,
    question: "How do they use AI in intake approvals?",
    shortAnswer: "Zip uses AI to classify intake requests and route approval workflows.",
    answerMarkdown: "*Short answer*\nZip uses AI to classify intake requests.",
    confidence: 0.81,
    evidence: [{ label: "AI intake", summary: "Product copy describes AI intake classification.", confidence: 0.86, sourceUrl: "https://ziphq.com/product/intake" }],
    inferences: [{ label: "Approval routing", summary: "Routing likely uses procurement context.", confidence: 0.7 }],
    unknowns: [{ label: "Model architecture", summary: "No public source describes model architecture.", confidence: 0.4 }],
    citations: [{ title: "Zip Intake", url: "https://ziphq.com/product/intake", excerpt: "AI classifies intake." }],
    generatedAt: "2026-06-13T10:00:00.000Z"
  };
}

describe("Slack competitor ask control", () => {
  it("answers a competitor question through the question-answer dependency", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    const questionAnswer = vi.fn(async () => answerFor(competitor));

    const response = await handleIntelSlashCommand({
      store,
      text: 'ask ziphq.com "How do they use AI in intake approvals?"',
      questionAnswer
    });
    const json = JSON.stringify(response.blocks);

    expect(response.response_type).toBe("in_channel");
    expect(response.text).toContain("Zip answer");
    expect(questionAnswer).toHaveBeenCalledWith(expect.objectContaining({
      competitor,
      question: "How do they use AI in intake approvals?"
    }));
    expect(json).toContain("Short answer");
    expect(json).toContain("AI intake");
    expect(json).toContain("Model architecture");
    expect(json).toContain("Zip Intake");
  });

  it("asks for a competitor and question when the command is incomplete", async () => {
    const response = await handleIntelSlashCommand({ store: new MemoryStore(), text: "ask ziphq.com" });

    expect(response.response_type).toBe("ephemeral");
    expect(response.text).toContain("Ask needs a competitor and question");
  });
});
