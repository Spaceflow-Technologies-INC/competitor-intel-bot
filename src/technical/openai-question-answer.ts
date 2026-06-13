import type { CompetitorQuestionAnswer, QuestionAnswerCitation, QuestionAnswerPoint } from "../types.js";
import { DeterministicQuestionAnswerer, type BuildQuestionAnswerInput, type CompetitorQuestionAnswerer } from "./question-answer.js";

export class OpenAIQuestionAnswerer implements CompetitorQuestionAnswerer {
  constructor(private readonly options: { apiKey: string; model: string; fallback?: CompetitorQuestionAnswerer }) {}

  async answer(input: BuildQuestionAnswerInput): Promise<CompetitorQuestionAnswer> {
    const fallback = this.options.fallback ?? new DeterministicQuestionAnswerer();
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
          text: {
            format: {
              type: "json_schema",
              name: "competitor_question_answer",
              strict: true,
              schema: answerSchema
            }
          },
          input: [
            {
              role: "system",
              content: [
                "You are a technical competitive intelligence analyst for Spaceflow.",
                "Answer only from provided evidence, extracted pages, signals, and technical briefs.",
                "Separate evidence, inference, and unknowns. Never invent private architecture.",
                "If the public sources do not prove something, place it in unknowns."
              ].join(" ")
            },
            {
              role: "user",
              content: JSON.stringify({
                competitor: input.competitor,
                question: input.question,
                evidence: input.evidence,
                signals: input.signals,
                pages: input.pages,
                technicalBrief: input.technicalBrief
              })
            }
          ]
        })
      });
      if (!response.ok) return fallback.answer(input);
      const json = await response.json() as OpenAIResponse;
      const parsed = parseAnswer(extractResponseText(json));
      if (!parsed) return fallback.answer(input);
      return {
        competitorId: input.competitor.id,
        question: input.question,
        shortAnswer: parsed.shortAnswer,
        answerMarkdown: parsed.answerMarkdown,
        confidence: clamp(parsed.confidence, 0.1, 0.98),
        evidence: normalizePoints(parsed.evidence),
        inferences: normalizePoints(parsed.inferences),
        unknowns: normalizePoints(parsed.unknowns),
        citations: normalizeCitations(parsed.citations),
        generatedAt: input.createdAt
      };
    } catch {
      return fallback.answer(input);
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

type ParsedAnswer = {
  shortAnswer: string;
  answerMarkdown: string;
  confidence: number;
  evidence: QuestionAnswerPoint[];
  inferences: QuestionAnswerPoint[];
  unknowns: QuestionAnswerPoint[];
  citations: QuestionAnswerCitation[];
};

const pointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["label", "summary", "confidence"],
  properties: {
    label: { type: "string" },
    summary: { type: "string" },
    confidence: { type: "number" },
    sourceUrl: { type: "string" }
  }
};

const citationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "url", "excerpt"],
  properties: {
    title: { type: "string" },
    url: { type: "string" },
    excerpt: { type: "string" }
  }
};

const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["shortAnswer", "answerMarkdown", "confidence", "evidence", "inferences", "unknowns", "citations"],
  properties: {
    shortAnswer: { type: "string" },
    answerMarkdown: { type: "string" },
    confidence: { type: "number" },
    evidence: { type: "array", items: pointSchema },
    inferences: { type: "array", items: pointSchema },
    unknowns: { type: "array", items: pointSchema },
    citations: { type: "array", items: citationSchema }
  }
};

function extractResponseText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text.trim();
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}

function parseAnswer(text: string): ParsedAnswer | undefined {
  if (!text) return undefined;
  try {
    const value = JSON.parse(text) as Partial<ParsedAnswer>;
    if (!value.shortAnswer || !value.answerMarkdown || typeof value.confidence !== "number") {
      return undefined;
    }
    return {
      shortAnswer: value.shortAnswer,
      answerMarkdown: value.answerMarkdown,
      confidence: value.confidence,
      evidence: value.evidence ?? [],
      inferences: value.inferences ?? [],
      unknowns: value.unknowns ?? [],
      citations: value.citations ?? []
    };
  } catch {
    return undefined;
  }
}

function normalizePoints(points: QuestionAnswerPoint[]): QuestionAnswerPoint[] {
  return points.filter((point) => point.label && point.summary).slice(0, 8).map((point) => {
    const normalized = {
      label: point.label,
      summary: point.summary,
      confidence: clamp(point.confidence, 0.1, 0.98)
    };
    return point.sourceUrl ? { ...normalized, sourceUrl: point.sourceUrl } : normalized;
  });
}

function normalizeCitations(citations: QuestionAnswerCitation[]): QuestionAnswerCitation[] {
  return citations
    .filter((citation) => citation.title && citation.url)
    .slice(0, 8)
    .map((citation) => ({
      title: citation.title,
      url: citation.url,
      excerpt: citation.excerpt
    }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
