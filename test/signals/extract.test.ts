import { describe, expect, it } from "vitest";

import { extractSignals } from "../../src/signals/extract.js";

describe("extractSignals", () => {
  it("extracts product launch and customer win signals", () => {
    const signals = extractSignals({
      competitorId: "competitor-1",
      snapshotId: "snapshot-1",
      url: "https://zipsource.example/blog/acme",
      title: "Acme Foods launches with ZipSource",
      bodyExcerpt: "ZipSource launched supplier onboarding agents with Acme Foods as a new enterprise customer."
    });

    expect(signals.map((signal) => signal.signalType)).toEqual(["customer_win", "product_launch"]);
    expect(signals[0]?.sourceUrls).toEqual(["https://zipsource.example/blog/acme"]);
  });
});
