import type { Competitor, TechnicalBrief, TechnicalEvidenceItem } from "../types.js";

export type TechnicalBriefSynthesizer = {
  build(input: BuildTechnicalBriefInput): Promise<TechnicalBrief>;
};

export type BuildTechnicalBriefInput = {
  competitor: Competitor;
  evidence: TechnicalEvidenceItem[];
  createdAt: string;
};

export class DeterministicTechnicalBriefSynthesizer implements TechnicalBriefSynthesizer {
  async build(input: BuildTechnicalBriefInput): Promise<TechnicalBrief> {
    return buildDeterministicTechnicalBrief(input);
  }
}

export function buildDeterministicTechnicalBrief(input: BuildTechnicalBriefInput): TechnicalBrief {
  const evidence = sortEvidence(input.evidence);
  const evidenceBacked = evidence.filter((item) => item.stance === "evidence");
  const inferences = evidence.filter((item) => item.stance === "inference");
  const unknowns = evidence.filter((item) => item.stance === "unknown");
  const confidence = confidenceFor(evidence);
  const executiveSummary = [
    `${input.competitor.name} technical brief is evidence-backed from ${evidenceBacked.length} public claim${evidenceBacked.length === 1 ? "" : "s"}.`,
    inferences.length > 0 ? `${inferences.length} workflow inference${inferences.length === 1 ? "" : "s"} need human review.` : "No workflow inferences were needed.",
    unknowns.length > 0 ? `${unknowns.length} technical unknown${unknowns.length === 1 ? "" : "s"} remain.` : "No core technical unknowns remain."
  ].join(" ");
  const markdown = [
    `*${input.competitor.name} technical brief*`,
    "",
    "*What they do technically*",
    summarizeWhatTheyDo(input.competitor, evidenceBacked),
    "",
    "*Feature map*",
    bullets(evidenceBacked.filter((item) => item.claimType === "feature"), "No public feature evidence found."),
    "",
    "*How they leverage AI*",
    bullets(evidenceBacked.filter((item) => item.claimType === "ai_usage"), "No public AI capability evidence found."),
    "",
    "*Workflow pipeline*",
    bullets([...evidenceBacked, ...inferences].filter((item) => item.claimType === "pipeline_step"), "No public pipeline evidence found."),
    "",
    "*Integrations and governance*",
    bullets(evidenceBacked.filter((item) => item.claimType === "integration" || item.claimType === "governance"), "No public integration or governance evidence found."),
    "",
    "*Technical moat*",
    summarizeMoat(input.competitor, evidenceBacked),
    "",
    "*Weaknesses*",
    summarizeWeaknesses(input.competitor, unknowns),
    "",
    "*Spaceflow counter-positioning*",
    summarizeCounterPosition(input.competitor, evidenceBacked, unknowns),
    "",
    "*Evidence*",
    bullets(evidenceBacked.slice(0, 8), "No evidence items captured."),
    "",
    "*Inference*",
    bullets(inferences.slice(0, 6), "No inference items captured."),
    "",
    "*Unknowns*",
    bullets(unknowns.slice(0, 6), "No unknowns captured.")
  ].join("\n");
  return {
    competitorId: input.competitor.id,
    title: `${input.competitor.name} technical brief`,
    executiveSummary,
    markdown,
    confidence,
    evidenceCount: evidenceBacked.length + inferences.length,
    unknownCount: unknowns.length,
    createdAt: input.createdAt
  };
}

function summarizeWhatTheyDo(competitor: Competitor, evidence: TechnicalEvidenceItem[]): string {
  const top = evidence[0];
  if (!top) return `${competitor.name} is tracked as ${competitor.category.replace(/_/g, " ")}; public technical evidence is still thin.`;
  return `${competitor.name} appears to compete through ${top.label.toLowerCase()} and adjacent ${competitor.category.replace(/_/g, " ")} workflows.`;
}

function summarizeMoat(competitor: Competitor, evidence: TechnicalEvidenceItem[]): string {
  const hasGovernance = evidence.some((item) => item.claimType === "governance");
  const hasIntegration = evidence.some((item) => item.claimType === "integration");
  if (hasGovernance && hasIntegration) return "Likely moat: governed workflow execution plus enterprise integration surface.";
  if (hasGovernance) return "Likely moat: governance, auditability, and permissioned execution claims.";
  if (hasIntegration) return "Likely moat: integration surface and system-of-record connectivity.";
  return `Likely moat: category focus and accumulated ${competitor.category.replace(/_/g, " ")} workflow knowledge.`;
}

function summarizeWeaknesses(competitor: Competitor, unknowns: TechnicalEvidenceItem[]): string {
  if (unknowns.length === 0) return "No obvious technical weakness from public sources; monitor implementation complexity and buyer proof.";
  return `${competitor.name} leaves public gaps around ${unknowns.slice(0, 3).map((item) => item.label.toLowerCase()).join(", ")}.`;
}

function summarizeCounterPosition(competitor: Competitor, evidence: TechnicalEvidenceItem[], unknowns: TechnicalEvidenceItem[]): string {
  const agentEvidence = evidence.some((item) => item.claimType === "ai_usage");
  const unknownText = unknowns.length > 0 ? ` Force clarity on ${unknowns[0]?.label.toLowerCase()} in competitive calls.` : "";
  return agentEvidence
    ? `Position Spaceflow as the faster manufacturing-first execution layer, not a generic procurement suite.${unknownText}`
    : `Position Spaceflow as the AI-native execution layer where ${competitor.name} has not publicly proven agentic depth.${unknownText}`;
}

function bullets(items: TechnicalEvidenceItem[], empty: string): string {
  if (items.length === 0) return `- ${empty}`;
  return items.map((item) => `- ${stanceLabel(item.stance)} ${item.label}: ${item.summary} (${Math.round(item.confidence * 100)}%)`).join("\n");
}

function stanceLabel(stance: TechnicalEvidenceItem["stance"]): string {
  if (stance === "evidence") return "Evidence:";
  if (stance === "inference") return "Inference:";
  return "Unknown:";
}

function confidenceFor(evidence: TechnicalEvidenceItem[]): number {
  if (evidence.length === 0) return 0.35;
  const known = evidence.filter((item) => item.stance !== "unknown");
  const base = known.reduce((sum, item) => sum + item.confidence, 0) / Math.max(known.length, 1);
  const unknownPenalty = Math.min(0.25, evidence.filter((item) => item.stance === "unknown").length * 0.04);
  return Math.max(0.35, Math.min(0.95, Number((base - unknownPenalty).toFixed(2))));
}

function sortEvidence(evidence: TechnicalEvidenceItem[]): TechnicalEvidenceItem[] {
  return [...evidence].sort((a, b) => stanceRank(a.stance) - stanceRank(b.stance) || b.confidence - a.confidence || a.label.localeCompare(b.label));
}

function stanceRank(stance: TechnicalEvidenceItem["stance"]): number {
  if (stance === "evidence") return 0;
  if (stance === "inference") return 1;
  return 2;
}
