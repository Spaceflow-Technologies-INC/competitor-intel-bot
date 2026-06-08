import { createHash } from "node:crypto";

import { loadConfig } from "../config.js";
import { seedCompetitors } from "../competitors/service.js";
import { shouldAlert, scoreSignal } from "../signals/scoring.js";
import { buildCompetitorSearchPlan } from "../sources/sector-queries.js";
import { normalizeSnapshot } from "../sources/normalize.js";
import { extractSignals } from "../signals/extract.js";
import { ParallelClient, type ExtractedPage, type WebIntelClient, type WebSearchResult } from "../sources/parallel-client.js";
import { createStore } from "../storage/index.js";
import type { Store } from "../storage/memory-store.js";
import type { SeedCompetitor } from "../types.js";
import { createLogger } from "../logger.js";

export type CollectionResult = {
  processedSignals: number;
  storedSignals: number;
  postedSignals: number;
  errors: number;
};

export async function runCollectionJob(): Promise<CollectionResult> {
  const config = loadConfig();
  if (!config.optionalApis.parallelApiKey) {
    throw new Error("PARALLEL_API_KEY is required for collection");
  }
  const store = await createStore(config.database);
  try {
    return await collectIntel({
      store,
      seeds: config.seedCompetitors,
      sourceClient: new ParallelClient({ apiKey: config.optionalApis.parallelApiKey }),
      alertThreshold: config.scoring.alertThreshold,
      fetchedAt: new Date().toISOString()
    });
  } finally {
    await closeStore(store);
  }
}

export type CollectIntelInput = {
  store: Store;
  seeds: SeedCompetitor[];
  sourceClient: WebIntelClient;
  fetchedAt?: string;
  alertThreshold: number;
};

export async function collectIntel(input: CollectIntelInput): Promise<CollectionResult> {
  const logger = createLogger();
  await seedCompetitors(input.store, input.seeds);
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  const competitors = await input.store.listCompetitors();
  let processedSignals = 0;
  let storedSignals = 0;
  let errors = 0;

  for (const competitor of competitors.sort((a, b) => a.monitoringPriority - b.monitoringPriority)) {
    try {
      const plan = buildCompetitorSearchPlan(competitor);
      const searchResults = await input.sourceClient.search({
        objective: plan.objective,
        searchQueries: plan.searchQueries
      });
      const pages = await extractPages(input.sourceClient, plan, searchResults);
      for (const page of pages) {
        const snapshot = normalizeSnapshot({
          sourceId: `parallel:${competitor.id}`,
          url: page.url,
          title: page.title,
          body: pageToBody(page),
          fetchedAt,
          metadata: { publishDate: page.publishDate }
        });
        const signals = extractSignals({
          competitorId: competitor.id,
          snapshotId: snapshot.id,
          url: snapshot.url,
          title: snapshot.title,
          bodyExcerpt: snapshot.bodyExcerpt
        });
        processedSignals += signals.length;
        for (const signal of signals) {
          const previousSimilarCount = await input.store.countSimilarSignals({
            competitorId: competitor.id,
            signalType: signal.signalType
          });
          const scores = scoreSignal({
            signalType: signal.signalType,
            sourceUrls: signal.sourceUrls,
            previousSimilarCount,
            competitorSimilarityScore: competitor.similarityScore
          });
          if (!shouldAlert(scores, input.alertThreshold)) {
            continue;
          }
          const scoredSignal = { ...signal, ...scores };
          const result = await input.store.recordSignal({
            signal: scoredSignal,
            uniqueKey: uniqueSignalKey(competitor.id, scoredSignal.signalType, scoredSignal.claim, scoredSignal.sourceUrls[0])
          });
          if (result.created) {
            storedSignals += 1;
          }
        }
      }
    } catch (error) {
      errors += 1;
      logger.error(
        {
          competitor: {
            id: competitor.id,
            name: competitor.name,
            domain: competitor.canonicalDomain,
            category: competitor.category
          },
          error: error instanceof Error ? error.message : String(error)
        },
        "competitor_collection_failed"
      );
    }
  }

  return { processedSignals, storedSignals, postedSignals: 0, errors };
}

async function extractPages(
  sourceClient: WebIntelClient,
  plan: { objective: string; searchQueries: string[] },
  searchResults: WebSearchResult[]
): Promise<ExtractedPage[]> {
  const urls = [...new Set(searchResults.map((result) => result.url))].slice(0, 5);
  const extracted = await sourceClient.extract({ urls, objective: plan.objective, searchQueries: plan.searchQueries });
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

function pageToBody(page: ExtractedPage): string {
  return [page.excerpts.join("\n"), page.fullContent ?? ""].filter(Boolean).join("\n\n");
}

function uniqueSignalKey(competitorId: string, signalType: string, claim: string, sourceUrl: string | undefined): string {
  return createHash("sha256")
    .update([competitorId, signalType, claim.toLowerCase(), sourceUrl ?? ""].join("|"))
    .digest("hex");
}

async function closeStore(store: Store): Promise<void> {
  if ("close" in store && typeof store.close === "function") {
    await store.close();
  }
}
