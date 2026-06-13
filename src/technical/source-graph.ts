import type { Competitor, IntelConfig, TechnicalSourceKind } from "../types.js";

export type TechnicalSourceTarget = {
  sourceType: TechnicalSourceKind;
  url?: string;
  searchQuery: string;
  priority: number;
};

export type TechnicalSourcePlan = {
  objective: string;
  searchQueries: string[];
  targets: TechnicalSourceTarget[];
};

export function buildTechnicalSourcePlan(input: { competitor: Competitor; config: IntelConfig }): TechnicalSourcePlan {
  const { competitor, config } = input;
  const targets = sourceTypesForDepth(config.researchDepth)
    .map((sourceType, index) => buildTarget(competitor, sourceType, index + 1));
  const searchQueries = [
    `${competitor.name} AI procurement workflow pipeline`,
    `${competitor.name} product features procurement sourcing supplier management`,
    `${competitor.name} API docs integrations procurement`,
    `${competitor.name} careers AI procurement engineering agent`,
    `${competitor.name} governed autonomy audit permissions`,
    `${competitor.name} changelog release notes AI sourcing`
  ];
  return {
    objective: [
      `Build technical competitor intelligence for ${competitor.name}.`,
      "Identify what the competitor does technically, its feature map, AI usage, workflow pipeline, integrations, governance, moats, weaknesses, and unknowns.",
      "Separate public evidence from inference."
    ].join(" "),
    searchQueries: dedupe(searchQueries),
    targets
  };
}

function sourceTypesForDepth(depth: IntelConfig["researchDepth"]): TechnicalSourceKind[] {
  if (depth === "light") {
    return ["homepage", "product", "news"];
  }
  const standard: TechnicalSourceKind[] = [
    "homepage",
    "product",
    "docs",
    "integrations",
    "security",
    "careers",
    "reviews",
    "changelog",
    "news"
  ];
  if (depth === "standard") {
    return standard;
  }
  return [...standard, "api_docs", "technographics", "webinar", "social", "pricing"];
}

function buildTarget(competitor: Competitor, sourceType: TechnicalSourceKind, priority: number): TechnicalSourceTarget {
  const domain = competitor.canonicalDomain;
  const base = `https://${domain}`;
  const urls: Partial<Record<TechnicalSourceKind, string>> = {
    homepage: base,
    product: `${base}/products`,
    pricing: `${base}/pricing`,
    docs: `${base}/docs`,
    api_docs: `${base}/docs/api`,
    changelog: `${base}/changelog`,
    integrations: `${base}/integrations`,
    security: `${base}/security`,
    careers: `${base}/careers`
  };
  return {
    sourceType,
    ...(urls[sourceType] ? { url: urls[sourceType] } : {}),
    searchQuery: queryForSource(competitor.name, sourceType),
    priority
  };
}

function queryForSource(name: string, sourceType: TechnicalSourceKind): string {
  const queryByType: Record<TechnicalSourceKind, string> = {
    homepage: `${name} official AI procurement platform`,
    product: `${name} product features procurement sourcing supplier workflow`,
    pricing: `${name} pricing packaging procurement platform`,
    docs: `${name} docs help center procurement workflow`,
    api_docs: `${name} API docs integrations procurement`,
    changelog: `${name} changelog release notes AI sourcing`,
    integrations: `${name} integrations SAP Oracle NetSuite procurement`,
    security: `${name} trust security permissions audit procurement`,
    careers: `${name} careers AI procurement engineering agent`,
    reviews: `${name} reviews G2 Capterra strengths weaknesses procurement`,
    social: `${name} LinkedIn AI procurement launch agents`,
    technographics: `${name} technology stack builtwith wappalyzer`,
    webinar: `${name} webinar demo AI procurement sourcing`,
    news: `${name} news funding customer launch AI procurement`,
    discovery: `${name} official website AI procurement`
  };
  return queryByType[sourceType];
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
