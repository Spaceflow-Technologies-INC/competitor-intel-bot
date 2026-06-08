import { afterEach, describe, expect, it, vi } from "vitest";

import { ParallelClient } from "../../src/sources/parallel-client.js";

describe("ParallelClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the v1 search endpoint with Spaceflow query context", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      search_id: "search-1",
      results: [
        {
          url: "https://coupa.com/news/acme",
          title: "Acme selects Coupa",
          publish_date: "2026-06-08",
          excerpts: ["Acme selected Coupa for AI sourcing automation."]
        }
      ],
      session_id: "session-1"
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ParallelClient({ apiKey: "parallel-test" });
    const results = await client.search({
      objective: "Find procurement AI competitor signals.",
      searchQueries: ["Coupa procurement AI"]
    });

    expect(results[0]?.url).toBe("https://coupa.com/news/acme");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.parallel.ai/v1/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "parallel-test" })
      })
    );
    const [, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(request.body)).search_queries).toEqual(["Coupa procurement AI"]);
  });

  it("extracts focused excerpts from result URLs", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      extract_id: "extract-1",
      results: [
        {
          url: "https://coupa.com/news/acme",
          title: "Acme selects Coupa",
          excerpts: ["Coupa launched a supplier onboarding AI agent with Acme."]
        }
      ],
      errors: [],
      session_id: "session-1"
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ParallelClient({ apiKey: "parallel-test" });
    const results = await client.extract({
      urls: ["https://coupa.com/news/acme"],
      objective: "Extract competitor intel.",
      searchQueries: ["Coupa AI agent"]
    });

    expect(results[0]?.excerpts[0]).toContain("supplier onboarding AI agent");
    expect(fetchMock).toHaveBeenCalledWith("https://api.parallel.ai/v1/extract", expect.any(Object));
  });
});
