export type CompetitorStatus = "seeded" | "approved" | "candidate" | "rejected" | "archived";

export type CompetitorCategory =
  | "procurement_ai"
  | "sourcing_automation"
  | "supplier_intelligence"
  | "erp_procurement"
  | "workflow_agent"
  | "adjacent";

export type SignalType =
  | "funding"
  | "acquisition"
  | "partnership"
  | "customer_win"
  | "case_study"
  | "product_launch"
  | "feature_release"
  | "integration"
  | "ai_capability"
  | "pricing_change"
  | "positioning_change"
  | "docs_change"
  | "hiring_signal"
  | "leadership_change"
  | "new_competitor_candidate";

export type SpaceflowImplication =
  | "threat"
  | "opportunity"
  | "watch"
  | "sales_enablement"
  | "product_gap"
  | "positioning"
  | "ignore_for_now";

export type SuggestedAction =
  | "watch"
  | "research"
  | "update_battlecard"
  | "share_with_sales"
  | "review_product_gap"
  | "ignore";

export type SeedCompetitor = {
  name: string;
  domain: string;
  category: CompetitorCategory;
};

export type Competitor = {
  id: string;
  name: string;
  canonicalDomain: string;
  status: CompetitorStatus;
  category: CompetitorCategory;
  similarityScore: number;
  monitoringPriority: number;
};

export type SourceSnapshot = {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  bodyExcerpt: string;
  rawHash: string;
  contentHash: string;
  fetchedAt: string;
  metadata: Record<string, unknown>;
};

export type IntelSignal = {
  id: string;
  competitorId: string | null;
  candidateId: string | null;
  signalType: SignalType;
  claim: string;
  summary: string;
  spaceflowImplication: SpaceflowImplication;
  suggestedAction: SuggestedAction;
  relevanceScore: number;
  noveltyScore: number;
  confidenceScore: number;
  impactScore: number;
  compositeScore: number;
  sourceUrls: string[];
};

export type SlackMessage = {
  text: string;
  blocks: Array<Record<string, unknown>>;
};
