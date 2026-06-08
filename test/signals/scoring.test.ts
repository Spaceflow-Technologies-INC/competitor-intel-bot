import { describe, expect, it } from "vitest";

import { scoreSignal, shouldAlert } from "../../src/signals/scoring.js";

describe("scoreSignal", () => {
  it("scores high-impact product launches above alert threshold", () => {
    const scored = scoreSignal({
      signalType: "product_launch",
      sourceUrls: ["https://zipsource.example/blog/launch"],
      previousSimilarCount: 0,
      competitorSimilarityScore: 0.9
    });

    expect(scored.compositeScore).toBeGreaterThanOrEqual(0.75);
    expect(shouldAlert(scored, 0.75)).toBe(true);
  });

  it("keeps repeated low-confidence docs changes out of alerts", () => {
    const scored = scoreSignal({
      signalType: "docs_change",
      sourceUrls: ["https://third-party.example/article"],
      previousSimilarCount: 3,
      competitorSimilarityScore: 0.5
    });

    expect(shouldAlert(scored, 0.75)).toBe(false);
  });
});
