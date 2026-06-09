import { describe, expect, it } from "vitest";

import { scoreSignal } from "../../src/signals/scoring.js";
import { scoreSourceUrl } from "../../src/signals/source-quality.js";

describe("source quality", () => {
  it("scores official competitor sources highest", () => {
    expect(scoreSourceUrl("https://coupa.com/pricing", "coupa.com")).toMatchObject({
      label: "Official",
      score: 0.95
    });
  });

  it("scores low-quality aggregators lower than trusted news", () => {
    expect(scoreSourceUrl("https://medium.com/random-post", "coupa.com").score).toBeLessThan(
      scoreSourceUrl("https://techcrunch.com/coupa-ai", "coupa.com").score
    );
  });

  it("uses source quality in signal confidence", () => {
    const official = scoreSignal({
      signalType: "product_launch",
      sourceUrls: ["https://coupa.com/launch"],
      previousSimilarCount: 0,
      competitorSimilarityScore: 0.8,
      competitorDomain: "coupa.com"
    });
    const weak = scoreSignal({
      signalType: "product_launch",
      sourceUrls: ["https://medium.com/some-rumor"],
      previousSimilarCount: 0,
      competitorSimilarityScore: 0.8,
      competitorDomain: "coupa.com"
    });

    expect(official.confidenceScore).toBeGreaterThan(weak.confidenceScore);
  });
});
