import type { Store } from "../storage/memory-store.js";
import type { SeedCompetitor } from "../types.js";
import { buildSeedSources } from "./seed.js";

export async function seedCompetitors(store: Store, seeds: SeedCompetitor[]): Promise<void> {
  for (const seed of seeds) {
    const competitor = await store.upsertCompetitor({
      name: seed.name,
      canonicalDomain: seed.domain,
      status: "seeded",
      category: seed.category,
      similarityScore: 0.8,
      monitoringPriority: 1
    });
    for (const source of buildSeedSources(seed)) {
      await store.upsertSource({
        competitorId: competitor.id,
        sourceType: source.sourceType,
        url: source.url,
        enabled: true
      });
    }
  }
}
