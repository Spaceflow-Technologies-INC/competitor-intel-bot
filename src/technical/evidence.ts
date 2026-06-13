import type { ExtractedPage } from "../sources/parallel-client.js";
import type { Competitor, EvidenceClaimType, TechnicalEvidenceItem, TechnicalSourceKind } from "../types.js";

export type ExtractTechnicalEvidenceInput = {
  competitor: Competitor;
  pages: ExtractedPage[];
  fetchedAt: string;
};

type EvidenceRule = {
  claimType: EvidenceClaimType;
  label: string;
  pattern: RegExp;
  summary: (competitor: Competitor, page: ExtractedPage) => string;
  confidence: number;
};

export function extractTechnicalEvidence(input: ExtractTechnicalEvidenceInput): TechnicalEvidenceItem[] {
  const items: TechnicalEvidenceItem[] = [];
  for (const page of input.pages) {
    const body = pageText(page);
    for (const rule of evidenceRules) {
      if (!rule.pattern.test(body)) {
        continue;
      }
      items.push({
        competitorId: input.competitor.id,
        claimType: rule.claimType,
        label: rule.label,
        summary: rule.summary(input.competitor, page),
        stance: "evidence",
        confidence: rule.confidence,
        sourceUrl: page.url,
        sourceType: inferSourceType(page.url),
        observedAt: input.fetchedAt
      });
    }
    if (hasAny(body, [/requirements/i, /intake/i, /RFx/i]) && hasAny(body, [/supplier/i, /scor/i, /evaluat/i])) {
      items.push(inferenceItem(input.competitor, page, input.fetchedAt, {
        claimType: "pipeline_step",
        label: "Intake to RFx workflow",
        summary: "Likely workflow from intake requirements to RFx generation, supplier response evaluation, and sourcing handoff.",
        confidence: 0.74
      }));
    }
  }
  return addUnknowns(input, dedupeEvidence(items));
}

const evidenceRules: EvidenceRule[] = [
  {
    claimType: "ai_usage",
    label: "RFx generation agent",
    pattern: /\bRFx generation agent\b|\bAI-powered RFx generation\b/i,
    summary: (_competitor, page) => `Public source says RFx generation converts requirements into supplier-ready sourcing packages. Source: ${page.title}.`,
    confidence: 0.92
  },
  {
    claimType: "ai_usage",
    label: "Competitive research agent",
    pattern: /\bcompetitive research agent\b/i,
    summary: (_competitor, page) => `Public source describes an agent for supplier and market research. Source: ${page.title}.`,
    confidence: 0.9
  },
  {
    claimType: "feature",
    label: "Vendor evaluation and scoring",
    pattern: /\bvendor evaluation\b|\bsupplier response(?:s)?\b.*\bscor/i,
    summary: (_competitor, page) => `Public source describes supplier/vendor response evaluation or scoring. Source: ${page.title}.`,
    confidence: 0.88
  },
  {
    claimType: "pipeline_step",
    label: "Sourcing project pipeline creation",
    pattern: /\bpipeline creation\b|\bcreate sourcing projects\b/i,
    summary: (_competitor, page) => `Public source describes creating sourcing projects with scope, owners, timelines, or savings targets. Source: ${page.title}.`,
    confidence: 0.86
  },
  {
    claimType: "integration",
    label: "ERP integration surface",
    pattern: /\bSAP\b|\bOracle\b|\bNetSuite\b|\bWorkday\b|\bintegration ecosystem\b/i,
    summary: (_competitor, page) => `Public source references enterprise integration surfaces. Source: ${page.title}.`,
    confidence: 0.8
  },
  {
    claimType: "governance",
    label: "Governed autonomy",
    pattern: /\bgoverned autonomy\b|\baudit\b|\bpermissions\b|\bhuman accountability\b/i,
    summary: (_competitor, page) => `Public source references governance, auditability, permissions, or bounded autonomy. Source: ${page.title}.`,
    confidence: 0.83
  }
];

const unknownChecks: Array<{ label: string; pattern: RegExp; summary: string }> = [
  {
    label: "Model architecture",
    pattern: /\b(model architecture|LLM architecture|routing architecture|agent architecture)\b/i,
    summary: "No public evidence found for model architecture."
  },
  {
    label: "Evaluation pipeline",
    pattern: /\b(eval|evaluation pipeline|benchmark|quality gate)\b/i,
    summary: "No public evidence found for AI evaluation or quality-gate pipeline."
  },
  {
    label: "Training data policy",
    pattern: /\btraining data|train.*LLM|customer data.*train/i,
    summary: "No public evidence found for training data policy beyond any trust/security claims captured separately."
  }
];

function addUnknowns(input: ExtractTechnicalEvidenceInput, items: TechnicalEvidenceItem[]): TechnicalEvidenceItem[] {
  const fullCorpus = input.pages.map(pageText).join("\n");
  const firstPage = input.pages[0];
  const sourceUrl = firstPage?.url ?? `https://${input.competitor.canonicalDomain}`;
  const sourceType = firstPage ? inferSourceType(firstPage.url) : "homepage";
  const unknowns = unknownChecks
    .filter((check) => !check.pattern.test(fullCorpus))
    .map((check): TechnicalEvidenceItem => ({
      competitorId: input.competitor.id,
      claimType: "unknown",
      label: check.label,
      summary: check.summary,
      stance: "unknown",
      confidence: 0.4,
      sourceUrl,
      sourceType,
      observedAt: input.fetchedAt
    }));
  return [...items, ...unknowns];
}

function inferenceItem(
  competitor: Competitor,
  page: ExtractedPage,
  fetchedAt: string,
  input: { claimType: EvidenceClaimType; label: string; summary: string; confidence: number }
): TechnicalEvidenceItem {
  return {
    competitorId: competitor.id,
    claimType: input.claimType,
    label: input.label,
    summary: input.summary,
    stance: "inference",
    confidence: input.confidence,
    sourceUrl: page.url,
    sourceType: inferSourceType(page.url),
    observedAt: fetchedAt
  };
}

export function inferSourceType(url: string): TechnicalSourceKind {
  const lower = url.toLowerCase();
  if (lower.includes("/docs") || lower.includes("help.")) return "docs";
  if (lower.includes("api")) return "api_docs";
  if (lower.includes("changelog") || lower.includes("release")) return "changelog";
  if (lower.includes("integration")) return "integrations";
  if (lower.includes("security") || lower.includes("trust")) return "security";
  if (lower.includes("career") || lower.includes("job")) return "careers";
  if (lower.includes("pricing")) return "pricing";
  if (lower.includes("g2.") || lower.includes("capterra") || lower.includes("trustradius")) return "reviews";
  if (lower.includes("linkedin.") || lower.includes("x.com")) return "social";
  if (lower.includes("webinar") || lower.includes("youtube.")) return "webinar";
  if (lower.includes("/products") || lower.includes("/product")) return "product";
  return "homepage";
}

function pageText(page: ExtractedPage): string {
  return [page.title, ...page.excerpts, page.fullContent ?? ""].join("\n");
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function dedupeEvidence(items: TechnicalEvidenceItem[]): TechnicalEvidenceItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.claimType, item.label, item.sourceUrl, item.stance].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
