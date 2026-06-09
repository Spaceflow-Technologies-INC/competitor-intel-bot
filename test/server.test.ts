import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import { MemoryStore } from "../src/storage/memory-store.js";

describe("server", () => {
  it("responds to health checks", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 })
    });

    const response = await server.inject({ method: "GET", url: "/ping" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("PONG");
  });

  it("runs collection job endpoint", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 2, storedSignals: 1, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 })
    });

    const response = await server.inject({ method: "POST", url: "/jobs/collect" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ processedSignals: 2, storedSignals: 1, postedSignals: 0, errors: 0 });
  });

  it("runs scheduled digest endpoint when configured", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 }),
      runScheduledDigest: async () => ({ postedSignals: 0, skipped: true, scheduledTime: "08:30" })
    });

    const response = await server.inject({ method: "POST", url: "/jobs/scheduled-digest" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ postedSignals: 0, skipped: true, scheduledTime: "08:30" });
  });

  it("can disable scheduler job endpoints for a public Slack-only service", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 2, storedSignals: 1, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 }),
      enableJobEndpoints: false
    });

    const response = await server.inject({ method: "POST", url: "/jobs/collect" });

    expect(response.statusCode).toBe(404);
  });

  it("handles Slack slash command form payloads", async () => {
    const store = new MemoryStore();
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 }),
      createStore: async () => store
    });

    const response = await server.inject({
      method: "POST",
      url: "/slack/commands",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        text: "add coupa.com Coupa procurement_ai",
        user_name: "orcun"
      }).toString()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      response_type: "in_channel"
    });
    await expect(store.listCompetitors()).resolves.toMatchObject([{ canonicalDomain: "coupa.com" }]);
  });

  it("rejects Slack requests with invalid signatures when a signing secret is configured", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 }),
      createStore: async () => new MemoryStore(),
      slackSigningSecret: "secret"
    });

    const response = await server.inject({
      method: "POST",
      url: "/slack/commands",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": "1710000000",
        "x-slack-signature": "v0=bad"
      },
      payload: new URLSearchParams({ text: "list" }).toString()
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects Slack requests when signature enforcement is on but no secret is configured", async () => {
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 }),
      createStore: async () => new MemoryStore(),
      requireSlackSignature: true
    });

    const response = await server.inject({
      method: "POST",
      url: "/slack/commands",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ text: "list" }).toString()
    });

    expect(response.statusCode).toBe(401);
  });

  it("turns Slack action buttons into control commands", async () => {
    const store = new MemoryStore();
    await store.upsertCompetitor({
      name: "Coupa",
      canonicalDomain: "coupa.com",
      status: "approved",
      category: "procurement_ai",
      similarityScore: 0.82,
      monitoringPriority: 1
    });
    const server = buildServer({
      runCollection: async () => ({ processedSignals: 0, storedSignals: 0, postedSignals: 0, errors: 0 }),
      runDailyDigest: async () => ({ postedSignals: 0 }),
      createStore: async () => store
    });

    const response = await server.inject({
      method: "POST",
      url: "/slack/interactions",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        payload: JSON.stringify({
          user: { username: "cfo" },
          actions: [{ value: "list" }]
        })
      }).toString()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ response_type: "ephemeral" });
    expect(response.body).toContain("coupa.com");
  });
});
