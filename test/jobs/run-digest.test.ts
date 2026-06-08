import { describe, expect, it, vi } from "vitest";

import { runMorningDigest } from "../../src/jobs/run-digest.js";
import { MemoryStore } from "../../src/storage/memory-store.js";
import type { IntelSignal } from "../../src/types.js";

const signal: IntelSignal = {
  id: "signal-1",
  competitorId: "competitor-1",
  candidateId: null,
  signalType: "customer_win",
  claim: "customer_win: Acme selects Coupa AI sourcing",
  summary: "Coupa launched supplier onboarding AI agents with Acme as a new enterprise customer.",
  spaceflowImplication: "sales_enablement",
  suggestedAction: "update_battlecard",
  relevanceScore: 0.9,
  noveltyScore: 1,
  confidenceScore: 0.85,
  impactScore: 0.9,
  compositeScore: 0.89,
  sourceUrls: ["https://coupa.com/news/acme"]
};

describe("runMorningDigest", () => {
  it("posts a morning digest and marks signals as posted", async () => {
    const store = new MemoryStore();
    await store.recordSignal({ signal, uniqueKey: "signal-key-1" });
    const slack = { postMessage: vi.fn(async () => ({ channel: "C123", ts: "1.23" })) };

    const result = await runMorningDigest({
      store,
      channelId: "C123",
      slack,
      summarizer: { summarize: async () => "Coupa has a customer-win signal relevant to sourcing automation." }
    });

    expect(result.postedSignals).toBe(1);
    expect(slack.postMessage).toHaveBeenCalledWith("C123", expect.objectContaining({
      text: "Morning competitor intel: 1 signal"
    }));
    await expect(store.listUnpostedSignals()).resolves.toHaveLength(0);
  });

  it("posts a heartbeat when no new intel exists", async () => {
    const store = new MemoryStore();
    const slack = { postMessage: vi.fn(async () => ({ channel: "C123", ts: "1.24" })) };

    const result = await runMorningDigest({
      store,
      channelId: "C123",
      slack,
      summarizer: { summarize: async () => "No new high-signal competitor movement found." }
    });

    expect(result.postedSignals).toBe(0);
    expect(slack.postMessage).toHaveBeenCalledOnce();
  });
});
