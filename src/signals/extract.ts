import { randomUUID } from "node:crypto";

import type { IntelSignal, SignalType } from "../types.js";

export type ExtractSignalsInput = {
  competitorId: string | null;
  candidateId?: string | null;
  snapshotId: string;
  url: string;
  title: string;
  bodyExcerpt: string;
};

const rules: Array<{
  type: SignalType;
  pattern: RegExp;
  implication: IntelSignal["spaceflowImplication"];
  action: IntelSignal["suggestedAction"];
}> = [
  { type: "funding", pattern: /\b(raised|funding|series\s+[abc]|seed round)\b/i, implication: "threat", action: "watch" },
  { type: "customer_win", pattern: /\b(customer|client|case study|launches with|selected by)\b/i, implication: "sales_enablement", action: "update_battlecard" },
  { type: "product_launch", pattern: /\b(launched|launches|introducing|announced|new product|new feature)\b/i, implication: "product_gap", action: "review_product_gap" },
  { type: "integration", pattern: /\b(integration|integrates|api|connector)\b/i, implication: "product_gap", action: "review_product_gap" },
  { type: "pricing_change", pattern: /\b(pricing|package|plan|tier)\b/i, implication: "positioning", action: "research" },
  { type: "hiring_signal", pattern: /\b(hiring|job|careers|head of|vp of)\b/i, implication: "watch", action: "watch" }
];

export function extractSignals(input: ExtractSignalsInput): IntelSignal[] {
  const text = `${input.title}\n${input.bodyExcerpt}`;
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => ({
      id: randomUUID(),
      competitorId: input.competitorId,
      candidateId: input.candidateId ?? null,
      signalType: rule.type,
      claim: buildClaim(rule.type, input.title),
      summary: input.bodyExcerpt.slice(0, 500),
      spaceflowImplication: rule.implication,
      suggestedAction: rule.action,
      relevanceScore: 0,
      noveltyScore: 0,
      confidenceScore: 0,
      impactScore: 0,
      compositeScore: 0,
      sourceUrls: [input.url]
    }));
}

function buildClaim(type: SignalType, title: string): string {
  return `${type}: ${title}`.slice(0, 180);
}
