import { describe, expect, it } from "vitest";

import { renderDailyDigestMessage, renderSignalAlertMessage } from "../../src/slack/render.js";
import type { IntelSignal } from "../../src/types.js";

const signal: IntelSignal = {
  id: "signal-1",
  competitorId: "competitor-1",
  candidateId: null,
  signalType: "product_launch",
  claim: "product_launch: Supplier agent launched",
  summary: "ZipSource launched supplier onboarding agents.",
  spaceflowImplication: "product_gap",
  suggestedAction: "review_product_gap",
  relevanceScore: 0.9,
  noveltyScore: 1,
  confidenceScore: 0.85,
  impactScore: 0.9,
  compositeScore: 0.89,
  sourceUrls: ["https://zipsource.example/blog/launch"]
};

describe("Slack renderers", () => {
  it("renders high-signal alerts with source links", () => {
    const message = renderSignalAlertMessage(signal);

    expect(message.text).toContain("Competitor signal");
    expect(JSON.stringify(message.blocks)).toContain("product_launch");
    expect(JSON.stringify(message.blocks)).toContain("https://zipsource.example/blog/launch");
  });

  it("renders daily digest with top signals", () => {
    const message = renderDailyDigestMessage([signal]);

    expect(message.text).toBe("Daily competitor intel digest: 1 signal");
    expect(JSON.stringify(message.blocks)).toContain("Supplier agent launched");
  });
});
