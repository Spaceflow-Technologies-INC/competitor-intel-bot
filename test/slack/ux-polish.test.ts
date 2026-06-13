import { describe, expect, it, vi } from "vitest";

import { handleIntelSlashCommand } from "../../src/slack/control.js";
import { MemoryStore } from "../../src/storage/memory-store.js";
import type { Competitor, CompetitorQuestionAnswer, TechnicalBrief } from "../../src/types.js";

function buttons(blocks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return blocks.flatMap((block) => (Array.isArray(block.elements) ? block.elements : []));
}

async function seedCompetitor(store: MemoryStore): Promise<Competitor> {
  return store.upsertCompetitor({
    name: "Coupa",
    canonicalDomain: "coupa.com",
    status: "approved",
    category: "procurement_ai",
    similarityScore: 0.82,
    monitoringPriority: 1
  });
}

describe("Slack competitor UX polish", () => {
  it("renders battlecards as guarded operator panels", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    await store.recordSignal({
      uniqueKey: "signal-key",
      signal: {
        id: "signal-1",
        competitorId: competitor.id,
        candidateId: null,
        signalType: "feature_release",
        claim: "feature_launch: Coupa launches AI intake",
        summary: "Coupa announced AI intake routing for procurement teams.",
        spaceflowImplication: "positioning",
        suggestedAction: "update_battlecard",
        relevanceScore: 0.9,
        noveltyScore: 0.9,
        confidenceScore: 0.95,
        impactScore: 0.85,
        compositeScore: 0.9,
        sourceUrls: ["https://coupa.com/news/ai-intake"]
      }
    });

    const response = await handleIntelSlashCommand({ store, text: "show coupa.com" });
    const renderedButtons = buttons(response.blocks);
    const json = JSON.stringify(response.blocks);

    expect(json).toContain("Latest signal");
    expect(json).toContain("Operator actions");
    expect(renderedButtons.map((button) => (button.text as { text?: string }).text)).toEqual(
      expect.arrayContaining(["Ask AI", "Technical brief", "Refresh scan", "Archive", "Delete"])
    );
    expect(renderedButtons.find((button) => button.action_id === "intel_archive")).toHaveProperty("confirm");
    expect(renderedButtons.find((button) => button.action_id === "intel_delete")).toMatchObject({
      style: "danger",
      confirm: { style: "danger" }
    });
  });

  it("renders discovered candidates with sources and confirmation gates", async () => {
    const store = new MemoryStore();

    const response = await handleIntelSlashCommand({
      store,
      text: 'add "Acme Sourcing"',
      discoverCompetitor: vi.fn(async () => ({
        name: "Acme Sourcing",
        canonicalDomain: "acmesourcing.ai",
        category: "sourcing_automation" as const,
        confidence: 0.81,
        evidenceUrls: ["https://acmesourcing.ai", "https://www.linkedin.com/company/acme-sourcing"]
      }))
    });
    const renderedButtons = buttons(response.blocks);
    const json = JSON.stringify(response.blocks);

    expect(json).toContain("Discovery sources");
    expect(renderedButtons.find((button) => button.action_id === "intel_reject_candidate")).toHaveProperty("confirm");
    expect(renderedButtons.find((button) => button.action_id === "intel_delete_candidate")).toMatchObject({
      style: "danger",
      confirm: { style: "danger" }
    });
  });

  it("renders competitor answers as evidence-first cards with next actions", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    const answer: CompetitorQuestionAnswer = {
      competitorId: competitor.id,
      question: "How do they use AI in intake approvals?",
      shortAnswer: "Coupa uses AI to classify intake and route approvals.",
      answerMarkdown: "Coupa uses AI to classify intake and route approvals.",
      confidence: 0.81,
      evidence: [{ label: "AI intake", summary: "Product copy describes AI intake classification.", confidence: 0.86, sourceUrl: "https://coupa.com/product/intake" }],
      inferences: [{ label: "Approval routing", summary: "Routing likely uses procurement policy context.", confidence: 0.7 }],
      unknowns: [{ label: "Model architecture", summary: "No public source describes model architecture.", confidence: 0.4 }],
      citations: [{ title: "Coupa Intake", url: "https://coupa.com/product/intake", excerpt: "AI classifies intake." }],
      generatedAt: "2026-06-13T10:00:00.000Z"
    };

    const response = await handleIntelSlashCommand({
      store,
      text: 'ask coupa.com "How do they use AI in intake approvals?"',
      questionAnswer: vi.fn(async () => answer)
    });
    const renderedButtons = buttons(response.blocks);
    const json = JSON.stringify(response.blocks);

    expect(json).toContain("Answer");
    expect(json).toContain("What is known");
    expect(json).toContain("Inferred from evidence");
    expect(json).toContain("Open gaps");
    expect(renderedButtons.map((button) => (button.text as { text?: string }).text)).toEqual(
      expect.arrayContaining(["Show battlecard", "Technical brief", "Evidence"])
    );
  });

  it("adds navigation actions to technical briefs", async () => {
    const store = new MemoryStore();
    const competitor = await seedCompetitor(store);
    const brief: TechnicalBrief = {
      competitorId: competitor.id,
      title: "Coupa technical brief",
      executiveSummary: "Coupa uses source-backed procurement AI workflows.",
      markdown: "*Evidence*\n- AI intake workflow\n\n*Unknowns*\n- Model architecture",
      confidence: 0.82,
      evidenceCount: 2,
      unknownCount: 1,
      createdAt: "2026-06-13T09:00:00.000Z"
    };

    const response = await handleIntelSlashCommand({
      store,
      text: "tech coupa.com",
      technicalResearch: vi.fn(async () => ({ brief, refreshed: false }))
    });
    const renderedButtons = buttons(response.blocks);
    const json = JSON.stringify(response.blocks);

    expect(json).toContain("Executive read");
    expect(json).toContain("Technical evidence");
    expect(renderedButtons.map((button) => (button.text as { text?: string }).text)).toEqual(
      expect.arrayContaining(["Show battlecard", "Refresh", "Evidence", "Unknowns"])
    );
  });
});
