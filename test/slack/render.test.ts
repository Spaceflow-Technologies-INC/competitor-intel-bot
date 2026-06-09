import { describe, expect, it } from "vitest";

import {
  renderDailyDigestMessage,
  renderMorningIntelDigestMessage,
  renderSignalAlertMessage
} from "../../src/slack/render.js";
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
  sourceUrls: ["https://zipsource.example/blog/launch", "https://news.example/zipsource-ai"]
};

const secondSignal: IntelSignal = {
  ...signal,
  id: "signal-2",
  signalType: "customer_win",
  claim: "customer_win: Acme expands ZipSource rollout",
  summary: "Acme expanded ZipSource across procurement operations after a supplier pilot.",
  suggestedAction: "update_battlecard",
  compositeScore: 0.82,
  sourceUrls: ["https://zipsource.example/customers/acme"]
};

describe("Slack renderers", () => {
  it("renders high-signal alerts with source links", () => {
    const message = renderSignalAlertMessage(signal);

    expect(message.text).toContain("Competitor signal");
    expect(JSON.stringify(message.blocks)).toContain("Product launch");
    expect(JSON.stringify(message.blocks)).toContain("<https://zipsource.example/blog/launch|Source 1: zipsource.example>");
  });

  it("renders daily digest with top signals", () => {
    const message = renderDailyDigestMessage([signal]);

    expect(message.text).toBe("Daily competitor intel digest: 1 signal");
    expect(JSON.stringify(message.blocks)).toContain("Supplier agent launched");
  });

  it("renders morning digest as a two-column Slack table with source links", () => {
    const message = renderMorningIntelDigestMessage(
      [signal, secondSignal],
      "# Executive read\n**ZipSource** is pushing supplier agents.\n- Review the battlecard."
    );

    const json = JSON.stringify(message.blocks);
    const tableBlock = message.blocks.find((block) => block.type === "table") as { rows: unknown[]; column_settings: unknown[] } | undefined;
    expect(message.text).toBe("Morning competitor intel: 2 signals");
    expect(message.blocks.some((block) => block.type === "divider")).toBe(true);
    expect(tableBlock).toBeDefined();
    expect(tableBlock?.rows).toHaveLength(1);
    expect((tableBlock?.rows[0] as unknown[] | undefined)).toHaveLength(2);
    expect(tableBlock?.column_settings).toEqual([{ is_wrapped: true }, { is_wrapped: true }]);
    expect(json).toContain("Executive read");
    expect(json).toContain("ZipSource is pushing supplier agents.");
    expect(json).not.toContain("**");
    expect(json).toContain("\"type\":\"link\"");
    expect(json).toContain("\"url\":\"https://zipsource.example/blog/launch\"");
    expect(json).toContain("\"url\":\"https://zipsource.example/customers/acme\"");
    expect(json).toContain("Next move");
  });

  it("renders empty morning digest without raw markdown noise", () => {
    const message = renderMorningIntelDigestMessage([], "## No **movement** today.");
    const json = JSON.stringify(message.blocks);

    expect(message.text).toBe("Morning competitor intel: 0 signals");
    expect(json).toContain("No high-signal competitor movement today.");
    expect(json).toContain("No movement today.");
    expect(json).not.toContain("**");
    expect(json).not.toContain("##");
  });
});
