import type { Competitor, CompetitorCategory } from "../types.js";

export type CompetitorSearchPlan = {
  objective: string;
  searchQueries: string[];
};

const categoryFocus: Record<CompetitorCategory, string> = {
  procurement_ai: "AI-native procurement automation, autonomous sourcing, RFQ agents, and supplier workflows",
  sourcing_automation: "sourcing automation, RFQ automation, bid comparison, and supplier selection",
  supplier_intelligence: "supplier intelligence, supplier risk, supplier discovery, and vendor data enrichment",
  erp_procurement: "enterprise procurement suites, AI procurement modules, and source-to-pay workflows",
  workflow_agent: "AI workflow agents for operations, procurement, and back-office automation",
  adjacent: "adjacent procurement, finance, supply-chain, and workflow automation markets"
};

export function buildCompetitorSearchPlan(competitor: Competitor): CompetitorSearchPlan {
  const focus = categoryFocus[competitor.category];
  return {
    objective: [
      `Find current competitor intelligence for ${competitor.name} in Spaceflow's market.`,
      `Spaceflow cares about procurement AI, sourcing automation, supplier intelligence, RFQ automation, purchase-order automation, and workflow agents.`,
      `This competitor is tracked as ${competitor.category}: ${focus}.`,
      "Prioritize product launches, AI capabilities, customer wins, partnerships, integrations, pricing changes, funding, acquisitions, leadership changes, and hiring signals.",
      "Prefer primary sources such as official blogs, press releases, docs, customer stories, pricing pages, careers pages, and reputable business news."
    ].join(" "),
    searchQueries: [
      `${competitor.name} procurement AI`,
      `${competitor.name} customer win sourcing`,
      `${competitor.name} AI procurement launch`,
      `${competitor.name} supplier automation partnership`,
      `${competitor.name} pricing funding acquisition`
    ]
  };
}
