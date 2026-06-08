import type { SeedCompetitor } from "../types.js";

export type SeedSource = {
  sourceType: "homepage" | "blog" | "pricing" | "careers";
  url: string;
};

export function buildSeedSources(seed: SeedCompetitor): SeedSource[] {
  const base = `https://${seed.domain}`;
  return [
    { sourceType: "homepage", url: base },
    { sourceType: "blog", url: `${base}/blog` },
    { sourceType: "pricing", url: `${base}/pricing` },
    { sourceType: "careers", url: `${base}/careers` }
  ];
}
