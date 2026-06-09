export type SourceQuality = {
  label: "Official" | "Trusted" | "General" | "Weak";
  score: number;
};

const trustedDomains = [
  "techcrunch.com",
  "businesswire.com",
  "prnewswire.com",
  "globenewswire.com",
  "reuters.com",
  "forbes.com"
];

const weakDomains = ["medium.com", "substack.com", "reddit.com", "quora.com", "wikipedia.org"];

export function scoreSourceUrl(url: string, competitorDomain?: string): SourceQuality {
  const domain = hostname(url);
  if (competitorDomain && domain === normalizeDomain(competitorDomain)) {
    return { label: "Official", score: 0.95 };
  }
  if (competitorDomain && domain.endsWith(`.${normalizeDomain(competitorDomain)}`)) {
    return { label: "Official", score: 0.92 };
  }
  if (trustedDomains.some((trusted) => domain === trusted || domain.endsWith(`.${trusted}`))) {
    return { label: "Trusted", score: 0.78 };
  }
  if (weakDomains.some((weak) => domain === weak || domain.endsWith(`.${weak}`))) {
    return { label: "Weak", score: 0.45 };
  }
  return { label: "General", score: 0.62 };
}

export function summarizeSourceQuality(urls: string[], competitorDomain?: string): SourceQuality {
  if (urls.length === 0) {
    return { label: "Weak", score: 0.35 };
  }
  return urls.map((url) => scoreSourceUrl(url, competitorDomain)).sort((a, b) => b.score - a.score)[0] ?? {
    label: "Weak",
    score: 0.35
  };
}

function hostname(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return normalizeDomain(url);
  }
}

function normalizeDomain(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0]?.toLowerCase() ?? value.toLowerCase();
}
