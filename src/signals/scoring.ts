import type { SignalType } from "../types.js";
import { summarizeSourceQuality } from "./source-quality.js";

export type ScoreSignalInput = {
  signalType: SignalType;
  sourceUrls: string[];
  previousSimilarCount: number;
  competitorSimilarityScore: number;
  competitorDomain?: string;
};

export type SignalScores = {
  relevanceScore: number;
  noveltyScore: number;
  confidenceScore: number;
  impactScore: number;
  compositeScore: number;
};

const impactByType: Record<SignalType, number> = {
  funding: 0.95,
  acquisition: 0.95,
  partnership: 0.8,
  customer_win: 0.9,
  case_study: 0.75,
  product_launch: 0.9,
  feature_release: 0.75,
  integration: 0.75,
  ai_capability: 0.85,
  pricing_change: 0.85,
  positioning_change: 0.7,
  docs_change: 0.45,
  hiring_signal: 0.6,
  leadership_change: 0.65,
  new_competitor_candidate: 0.7
};

export function scoreSignal(input: ScoreSignalInput): SignalScores {
  const relevanceScore = clamp(input.competitorSimilarityScore);
  const noveltyScore = clamp(1 - input.previousSimilarCount * 0.25);
  const confidenceScore = confidenceFromSources(input.sourceUrls, input.competitorDomain);
  const impactScore = impactByType[input.signalType];
  const compositeScore = clamp(
    0.3 * relevanceScore + 0.25 * impactScore + 0.25 * confidenceScore + 0.2 * noveltyScore
  );
  return { relevanceScore, noveltyScore, confidenceScore, impactScore, compositeScore };
}

export function shouldAlert(scores: SignalScores, threshold: number): boolean {
  return scores.compositeScore >= threshold || (scores.impactScore >= 0.85 && scores.confidenceScore >= 0.65);
}

function confidenceFromSources(urls: string[], competitorDomain?: string): number {
  const quality = summarizeSourceQuality(urls, competitorDomain);
  const multiSourceBoost = Math.min(0.08, Math.max(0, urls.length - 1) * 0.04);
  return clamp(quality.score + multiSourceBoost);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}
