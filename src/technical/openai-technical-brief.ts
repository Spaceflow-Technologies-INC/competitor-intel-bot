import type { TechnicalBrief } from "../types.js";
import { buildDeterministicTechnicalBrief, DeterministicTechnicalBriefSynthesizer, type BuildTechnicalBriefInput, type TechnicalBriefSynthesizer } from "./brief.js";

export class OpenAITechnicalBriefSynthesizer implements TechnicalBriefSynthesizer {
  constructor(private readonly options: { apiKey: string; model: string; fallback?: TechnicalBriefSynthesizer }) {}

  async build(input: BuildTechnicalBriefInput): Promise<TechnicalBrief> {
    const fallback = this.options.fallback ?? new DeterministicTechnicalBriefSynthesizer();
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.options.apiKey}`
        },
        body: JSON.stringify({
          model: this.options.model,
          store: false,
          input: [
            {
              role: "system",
              content: [
                "You are a technical competitive intelligence analyst for Spaceflow.",
                "Write concise Slack-readable markdown.",
                "Separate Evidence, Inference, and Unknown. Never invent private architecture."
              ].join(" ")
            },
            {
              role: "user",
              content: JSON.stringify({
                competitor: input.competitor,
                evidence: input.evidence
              })
            }
          ]
        })
      });
      if (!response.ok) return fallback.build(input);
      const json = await response.json() as OpenAIResponse;
      const text = extractResponseText(json);
      if (!text) return fallback.build(input);
      const deterministic = buildDeterministicTechnicalBrief(input);
      return {
        ...deterministic,
        markdown: text,
        executiveSummary: firstSentence(text) || deterministic.executiveSummary
      };
    } catch {
      return fallback.build(input);
    }
  }
}

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

function extractResponseText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text.trim();
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}

function firstSentence(text: string): string {
  return text.split(/\n|(?<=\.)\s+/).find((part) => part.trim().length > 0)?.trim() ?? "";
}
