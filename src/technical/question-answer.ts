import type { ExtractedPage } from "../sources/parallel-client.js";
import type { Competitor, CompetitorQuestionAnswer, IntelSignal, QuestionAnswerCitation, QuestionAnswerPoint, TechnicalBrief, TechnicalEvidenceItem } from "../types.js";

export type BuildQuestionAnswerInput = {
  competitor: Competitor;
  question: string;
  evidence: TechnicalEvidenceItem[];
  signals: IntelSignal[];
  pages: ExtractedPage[];
  technicalBrief?: TechnicalBrief;
  createdAt: string;
};

export type CompetitorQuestionAnswerer = {
  answer(input: BuildQuestionAnswerInput): Promise<CompetitorQuestionAnswer>;
};

export class DeterministicQuestionAnswerer implements CompetitorQuestionAnswerer {
  async answer(input: BuildQuestionAnswerInput): Promise<CompetitorQuestionAnswer> {
    const evidence = input.evidence
      .filter((item) => item.stance === "evidence")
      .slice(0, 6)
      .map(evidencePoint);
    const unknowns = input.evidence
      .filter((item) => item.stance === "unknown")
      .slice(0, 4)
      .map(evidencePoint);
    const inferences = buildInferences(input, evidence);
    const citations = buildCitations(input.pages, input.evidence);
    const confidence = scoreConfidence(evidence, citations, unknowns);
    const shortAnswer = buildShortAnswer(input.competitor, input.question, evidence, unknowns);
    return {
      competitorId: input.competitor.id,
      question: input.question,
      shortAnswer,
      answerMarkdown: buildMarkdown(shortAnswer, evidence, inferences, unknowns),
      confidence,
      evidence,
      inferences,
      unknowns,
      citations,
      generatedAt: input.createdAt
    };
  }
}

function evidencePoint(item: TechnicalEvidenceItem): QuestionAnswerPoint {
  return {
    label: item.label,
    summary: item.summary,
    confidence: item.confidence,
    sourceUrl: item.sourceUrl
  };
}

function buildInferences(input: BuildQuestionAnswerInput, evidence: QuestionAnswerPoint[]): QuestionAnswerPoint[] {
  const pageText = input.pages.flatMap((page) => page.excerpts).join(" ").toLowerCase();
  const question = input.question.toLowerCase();
  const focus = question.includes("intake") || pageText.includes("intake") ? "intake" : "workflow";
  if (evidence.length === 0) {
    return [{
      label: "Insufficient public evidence",
      summary: `There is not enough source-backed evidence to infer how ${input.competitor.name} handles this yet.`,
      confidence: 0.35
    }];
  }
  return [{
    label: "Likely workflow pattern",
    summary: `Based on the captured evidence, ${input.competitor.name} likely connects ${focus} capture, AI-assisted classification, and approval routing before downstream procurement sync.`,
    confidence: Math.min(0.82, Math.max(0.55, average(evidence.map((item) => item.confidence)) - 0.08))
  }];
}

function buildCitations(pages: ExtractedPage[], evidence: TechnicalEvidenceItem[]): QuestionAnswerCitation[] {
  const citationMap = new Map<string, QuestionAnswerCitation>();
  for (const page of pages) {
    citationMap.set(page.url, {
      title: page.title,
      url: page.url,
      excerpt: firstText(page.excerpts, page.fullContent)
    });
  }
  for (const item of evidence) {
    if (!citationMap.has(item.sourceUrl)) {
      citationMap.set(item.sourceUrl, {
        title: item.label,
        url: item.sourceUrl,
        excerpt: item.summary
      });
    }
  }
  return [...citationMap.values()].filter((item) => item.url).slice(0, 8);
}

function buildShortAnswer(competitor: Competitor, question: string, evidence: QuestionAnswerPoint[], unknowns: QuestionAnswerPoint[]): string {
  if (evidence.length === 0) {
    return `${competitor.name} does not have enough captured public evidence to answer "${question}" confidently yet.`;
  }
  const strongest = evidence[0];
  const caveat = unknowns.length > 0 ? ` The main caveat is ${unknowns[0]?.label.toLowerCase()}.` : "";
  return `${competitor.name} appears to answer this through ${strongest?.label.toLowerCase()}: ${strongest?.summary}${caveat}`;
}

function buildMarkdown(shortAnswer: string, evidence: QuestionAnswerPoint[], inferences: QuestionAnswerPoint[], unknowns: QuestionAnswerPoint[]): string {
  return [
    `*Short answer*\n${shortAnswer}`,
    renderPoints("Evidence", evidence),
    renderPoints("Inference", inferences),
    renderPoints("Unknowns", unknowns)
  ].filter(Boolean).join("\n\n");
}

function renderPoints(title: string, points: QuestionAnswerPoint[]): string {
  if (points.length === 0) return `*${title}*\n- None found.`;
  return [`*${title}*`, ...points.map((point) => `- ${point.label}: ${point.summary}`)].join("\n");
}

function scoreConfidence(evidence: QuestionAnswerPoint[], citations: QuestionAnswerCitation[], unknowns: QuestionAnswerPoint[]): number {
  if (evidence.length === 0) return 0.32;
  const evidenceScore = average(evidence.map((item) => item.confidence));
  const citationBoost = Math.min(0.12, citations.length * 0.02);
  const unknownPenalty = Math.min(0.18, unknowns.length * 0.04);
  return clamp(evidenceScore + citationBoost - unknownPenalty, 0.25, 0.94);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function firstText(excerpts: string[], fullContent?: string): string {
  return (excerpts.find((item) => item.trim().length > 0) ?? fullContent ?? "").slice(0, 500);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
