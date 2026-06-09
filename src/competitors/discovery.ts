import type { CompetitorCategory } from "../types.js";
import type { WebSearchResult } from "../sources/parallel-client.js";

export type CompetitorDiscoveryQuery = {
  rawQuery: string;
  category?: CompetitorCategory;
  priority?: number;
};

export type CompetitorDiscoveryResult = {
  name: string;
  canonicalDomain: string;
  category: CompetitorCategory;
  confidence: number;
  evidenceUrls: string[];
};

export type CompetitorSearch = (input: { objective: string; searchQueries: string[] }) => Promise<WebSearchResult[]>;

const blockedHosts = [
  "linkedin.com",
  "crunchbase.com",
  "wikipedia.org",
  "facebook.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "g2.com",
  "capterra.com"
];

export async function discoverCompetitor(input: CompetitorDiscoveryQuery & { search: CompetitorSearch }): Promise<CompetitorDiscoveryResult | undefined> {
  const normalizedQuery = normalizeDiscoveryQuery(input.rawQuery);
  if (!normalizedQuery) return undefined;
  const results = await input.search({
    objective: "Find the official company website for a potential Spaceflow competitor. Prefer the company's own homepage over LinkedIn, directories, press, or review sites.",
    searchQueries: buildDiscoveryQueries(normalizedQuery, input.category)
  });
  const candidate = chooseOfficialWebsite(results, normalizedQuery);
  if (!candidate) return undefined;
  return {
    name: inferName(input.rawQuery, candidate),
    canonicalDomain: normalizeDomain(candidate.url),
    category: input.category ?? inferCategory(`${candidate.title} ${candidate.excerpts.join(" ")}`),
    confidence: confidenceFor(candidate, normalizedQuery),
    evidenceUrls: [...new Set([candidate.url, ...results.slice(0, 4).map((result) => result.url)])]
  };
}

function buildDiscoveryQueries(query: string, category: CompetitorCategory | undefined): string[] {
  const categoryHint = category ? category.replace(/_/g, " ") : "procurement AI sourcing automation";
  return [
    `${query} official website ${categoryHint}`,
    `${query} company homepage AI procurement`,
    `${query} LinkedIn company official website`
  ];
}

function chooseOfficialWebsite(results: WebSearchResult[], query: string): WebSearchResult | undefined {
  return [...results]
    .filter((result) => !isBlockedHost(result.url))
    .sort((a, b) => scoreSearchResult(b, query) - scoreSearchResult(a, query))[0];
}

function scoreSearchResult(result: WebSearchResult, query: string): number {
  const host = normalizeDomain(result.url);
  const queryWords = words(query);
  const haystack = `${host} ${result.title} ${result.excerpts.join(" ")}`.toLowerCase();
  const wordMatches = queryWords.filter((word) => haystack.includes(word)).length;
  const rootPathBonus = isRootLikePath(result.url) ? 0.2 : 0;
  const hostBonus = queryWords.some((word) => host.includes(word)) ? 0.25 : 0;
  return wordMatches / Math.max(1, queryWords.length) + rootPathBonus + hostBonus;
}

function inferName(rawQuery: string, result: WebSearchResult): string {
  const fromRaw = titleize(normalizeDiscoveryQuery(rawQuery));
  const fromTitle = result.title.split(/[|–—-]/)[0]?.trim();
  return fromRaw || fromTitle || titleize(normalizeDomain(result.url).split(".")[0] ?? result.title);
}

function inferCategory(text: string): CompetitorCategory {
  const lower = text.toLowerCase();
  if (lower.includes("supplier") || lower.includes("vendor intelligence")) return "supplier_intelligence";
  if (lower.includes("sourcing")) return "sourcing_automation";
  if (lower.includes("erp") || lower.includes("ariba") || lower.includes("oracle")) return "erp_procurement";
  if (lower.includes("agent") || lower.includes("workflow")) return "workflow_agent";
  return "procurement_ai";
}

function confidenceFor(result: WebSearchResult, query: string): number {
  return Math.min(0.9, Math.max(0.58, scoreSearchResult(result, query) * 0.65 + 0.45));
}

function normalizeDiscoveryQuery(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.hostname.includes("linkedin.com")) return titleize(url.pathname.split("/").filter(Boolean).pop() ?? trimmed).toLowerCase();
    if (url.hostname.includes(".")) return titleize(url.hostname.replace(/^www\./i, "").split(".")[0] ?? trimmed).toLowerCase();
  } catch {
    // Plain names fall through.
  }
  return trimmed.toLowerCase();
}

function isBlockedHost(url: string): boolean {
  const host = normalizeDomain(url);
  return blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function isRootLikePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return false;
  }
}

function normalizeDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
}

function titleize(value: string): string {
  return value.replace(/[-_]+/g, " ").trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
}
