import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAIQuestionAnswerer } from "../../src/technical/openai-question-answer.js";
import { DeterministicQuestionAnswerer, type BuildQuestionAnswerInput } from "../../src/technical/question-answer.js";
import type { Competitor } from "../../src/types.js";

const competitor: Competitor = {
  id: "zip-id",
  name: "Zip",
  canonicalDomain: "ziphq.com",
  status: "approved",
  category: "procurement_ai",
  similarityScore: 0.91,
  monitoringPriority: 1
};

const input: BuildQuestionAnswerInput = {
  competitor,
  question: "How does Zip use AI in intake approvals?",
  evidence: [],
  signals: [],
  pages: [{
    url: "https://ziphq.com/product/intake",
    title: "Zip Intake",
    excerpts: ["AI classifies intake and routes approval workflows."]
  }],
  createdAt: "2026-06-13T10:00:00.000Z"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAIQuestionAnswerer", () => {
  it("uses structured outputs and parses a source-backed answer", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.text.format).toMatchObject({
        type: "json_schema",
        name: "competitor_question_answer",
        strict: true
      });
      return response(200, {
        output_text: JSON.stringify({
          shortAnswer: "Zip uses AI to classify intake and route approvals.",
          answerMarkdown: "*Short answer*\nZip uses AI for intake classification.",
          confidence: 0.81,
          evidence: [{ label: "AI intake", summary: "AI classifies intake.", confidence: 0.86, sourceUrl: "https://ziphq.com/product/intake" }],
          inferences: [{ label: "Approval routing", summary: "Routing likely uses procurement context.", confidence: 0.7 }],
          unknowns: [{ label: "Model architecture", summary: "No public source describes the model architecture.", confidence: 0.4 }],
          citations: [{ title: "Zip Intake", url: "https://ziphq.com/product/intake", excerpt: "AI classifies intake." }]
        })
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const answer = await new OpenAIQuestionAnswerer({ apiKey: "openai-test", model: "gpt-5.4-mini" }).answer(input);

    expect(answer.shortAnswer).toContain("classify intake");
    expect(answer.evidence[0]?.sourceUrl).toBe("https://ziphq.com/product/intake");
    expect(answer.unknowns[0]?.label).toBe("Model architecture");
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST"
    }));
  });

  it("falls back to deterministic answers when OpenAI fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(500, { error: "bad" })));

    const fallback = new DeterministicQuestionAnswerer();
    const answer = await new OpenAIQuestionAnswerer({ apiKey: "openai-test", model: "gpt-5.4-mini", fallback }).answer(input);

    expect(answer.shortAnswer).toContain("Zip");
    expect(answer.generatedAt).toBe(input.createdAt);
  });
});

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}
