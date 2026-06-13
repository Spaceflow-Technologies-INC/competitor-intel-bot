import type { WebIntelClient, ExtractedPage, WebSearchResult } from "../sources/parallel-client.js";
import type { Store } from "../storage/memory-store.js";
import type { Competitor, TechnicalBrief } from "../types.js";
import { DeterministicTechnicalBriefSynthesizer, type TechnicalBriefSynthesizer } from "./brief.js";
import { extractTechnicalEvidence } from "./evidence.js";
import { buildTechnicalSourcePlan } from "./source-graph.js";

export type ResearchTechnicalBriefInput = {
  store: Store;
  competitor: Competitor;
  sourceClient: WebIntelClient;
  synthesizer?: TechnicalBriefSynthesizer;
  forceRefresh?: boolean;
  now?: string;
};

export type ResearchTechnicalBriefResult = {
  brief: TechnicalBrief;
  refreshed: boolean;
};

export async function researchTechnicalBrief(input: ResearchTechnicalBriefInput): Promise<ResearchTechnicalBriefResult> {
  if (!input.forceRefresh) {
    const cached = await input.store.getLatestTechnicalBrief(input.competitor.id);
    if (cached) {
      return { brief: cached, refreshed: false };
    }
  }
  const config = await input.store.getIntelConfig();
  const plan = buildTechnicalSourcePlan({ competitor: input.competitor, config });
  const searchResults = await input.sourceClient.search({
    objective: plan.objective,
    searchQueries: plan.searchQueries
  });
  const pages = await extractTechnicalPages(input.sourceClient, plan.objective, plan.searchQueries, [
    ...plan.targets.map((target) => target.url).filter((url): url is string => Boolean(url)),
    ...searchResults.map((result) => result.url)
  ], searchResults);
  const observedAt = input.now ?? new Date().toISOString();
  const evidence = await input.store.recordEvidenceItems(extractTechnicalEvidence({
    competitor: input.competitor,
    pages,
    fetchedAt: observedAt
  }));
  const synthesizer = input.synthesizer ?? new DeterministicTechnicalBriefSynthesizer();
  const brief = await synthesizer.build({
    competitor: input.competitor,
    evidence,
    createdAt: observedAt
  });
  return { brief: await input.store.saveTechnicalBrief(brief), refreshed: true };
}

async function extractTechnicalPages(
  sourceClient: WebIntelClient,
  objective: string,
  searchQueries: string[],
  urls: string[],
  searchResults: WebSearchResult[]
): Promise<ExtractedPage[]> {
  const uniqueUrls = [...new Set(urls)].slice(0, 14);
  const extracted = await sourceClient.extract({ urls: uniqueUrls, objective, searchQueries });
  if (extracted.length > 0) {
    return extracted;
  }
  return searchResults.map((result) => {
    const page: ExtractedPage = {
      url: result.url,
      title: result.title,
      excerpts: result.excerpts
    };
    return result.publishDate ? { ...page, publishDate: result.publishDate } : page;
  });
}
