import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";

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
});
