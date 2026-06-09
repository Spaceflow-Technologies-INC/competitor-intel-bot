import { describe, expect, it } from "vitest";

import { discoverCompetitor } from "../../src/competitors/discovery.js";

describe("competitor discovery", () => {
  it("finds an official website from a plain company name", async () => {
    const result = await discoverCompetitor({
      rawQuery: "Acme Sourcing",
      category: "sourcing_automation",
      search: async () => [
        {
          title: "Acme Sourcing - AI sourcing automation",
          url: "https://acmesourcing.ai/",
          excerpts: ["AI sourcing automation for procurement teams."]
        },
        {
          title: "Acme Sourcing | LinkedIn",
          url: "https://www.linkedin.com/company/acme-sourcing/",
          excerpts: ["Company profile"]
        }
      ]
    });

    expect(result).toMatchObject({
      name: "Acme Sourcing",
      canonicalDomain: "acmesourcing.ai",
      category: "sourcing_automation"
    });
    expect(result?.evidenceUrls).toContain("https://www.linkedin.com/company/acme-sourcing/");
  });

  it("uses a LinkedIn company slug to find the official website instead of adding linkedin.com", async () => {
    const result = await discoverCompetitor({
      rawQuery: "https://www.linkedin.com/company/acme-sourcing/",
      search: async (input) => {
        expect(input.searchQueries.join(" ")).toContain("acme sourcing");
        return [
          {
            title: "Acme Sourcing | LinkedIn",
            url: "https://www.linkedin.com/company/acme-sourcing/",
            excerpts: ["Company profile"]
          },
          {
            title: "Acme Sourcing",
            url: "https://acmesourcing.ai",
            excerpts: ["Autonomous sourcing workflows for procurement."]
          }
        ];
      }
    });

    expect(result?.canonicalDomain).toBe("acmesourcing.ai");
    expect(result?.name).toBe("Acme Sourcing");
  });
});
