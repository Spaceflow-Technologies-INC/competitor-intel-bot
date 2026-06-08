import { describe, expect, it } from "vitest";

import { selectDailyDigestSignals } from "../../src/digests/daily.js";
import type { IntelSignal } from "../../src/types.js";

describe("selectDailyDigestSignals", () => {
  it("selects top five signals by composite score", () => {
    const signals = Array.from({ length: 7 }, (_, index): IntelSignal => ({
      id: `signal-${index}`,
      competitorId: "competitor-1",
      candidateId: null,
      signalType: "product_launch",
      claim: `Signal ${index}`,
      summary: "Summary",
      spaceflowImplication: "watch",
      suggestedAction: "watch",
      relevanceScore: 0.8,
      noveltyScore: 0.8,
      confidenceScore: 0.8,
      impactScore: 0.8,
      compositeScore: index / 10,
      sourceUrls: ["https://example.com"]
    }));

    expect(selectDailyDigestSignals(signals).map((signal) => signal.id)).toEqual([
      "signal-6",
      "signal-5",
      "signal-4",
      "signal-3",
      "signal-2"
    ]);
  });
});
