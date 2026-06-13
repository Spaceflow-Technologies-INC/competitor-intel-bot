import type { ResearchTechnicalBriefResult } from "../technical/research.js";
import { buildTechnicalSourcePlan } from "../technical/source-graph.js";
import type { Competitor, CompetitorQuestionAnswer, EvidenceClaimType, IntelConfig } from "../types.js";
import type { Store } from "../storage/memory-store.js";
import { findCompetitor } from "./competitor-status.js";
import { renderQuestionAnswer, renderQuestionUnavailable } from "./question-render.js";
import {
  renderEvidenceList,
  renderOnboarding,
  renderSourceGraph,
  renderTechnicalBrief,
  renderTechnicalComparison,
  renderTechnicalHelp,
  renderTechnicalUnavailable,
  type SlackControlResponse
} from "./technical-render.js";

export type TechnicalResearchRunner = (input: {
  store: Store;
  competitor: Competitor;
  forceRefresh: boolean;
}) => Promise<ResearchTechnicalBriefResult>;

export type QuestionAnswerRunner = (input: {
  store: Store;
  competitor: Competitor;
  question: string;
}) => Promise<CompetitorQuestionAnswer>;

export type TechnicalCommandInput = {
  store: Store;
  command: string;
  tokens: string[];
  technicalResearch?: TechnicalResearchRunner;
  questionAnswer?: QuestionAnswerRunner;
};

const claimTypes = new Set<EvidenceClaimType>([
  "feature",
  "ai_usage",
  "pipeline_step",
  "integration",
  "governance",
  "moat",
  "weakness",
  "spaceflow_counter",
  "unknown"
]);

export async function handleTechnicalCommand(input: TechnicalCommandInput): Promise<SlackControlResponse | undefined> {
  if (input.command === "onboard") return handleOnboarding(input.store, input.tokens);
  if (input.command === "sources") return handleSources(input.store, input.tokens.join(" "));
  if (input.command === "tech" || input.command === "brief") return handleBrief(input, false);
  if (input.command === "refresh") return handleBrief(input, true);
  if (input.command === "compare") return handleCompare(input);
  if (input.command === "ask") return handleAsk(input);
  if (input.command === "evidence") return handleEvidence(input.store, input.tokens);
  if (input.command === "unknowns") return handleUnknowns(input.store, input.tokens.join(" "));
  return undefined;
}

async function handleOnboarding(store: Store, tokens: string[]): Promise<SlackControlResponse> {
  const current = await store.getIntelConfig();
  if (tokens.length === 0) return renderOnboarding(current);
  const updated: IntelConfig = {
    ...current,
    categories: [...current.categories],
    sourcePreferences: [...current.sourcePreferences]
  };
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index]?.toLowerCase();
    const value = tokens[index + 1]?.toLowerCase();
    if (!key || !value) continue;
    if (key === "depth" && isResearchDepth(value)) updated.researchDepth = value;
    if (key === "audience" && isBriefAudience(value)) updated.briefAudience = value;
    if (key === "cadence" && isCadence(value)) updated.cadence = value;
  }
  return renderOnboarding(await store.saveIntelConfig(updated), true);
}

async function handleSources(store: Store, query: string): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderTechnicalHelp(`Could not find competitor: ${query || "(empty)"}`);
  const config = await store.getIntelConfig();
  return renderSourceGraph(competitor, buildTechnicalSourcePlan({ competitor, config }));
}

async function handleBrief(input: TechnicalCommandInput, forceRefresh: boolean): Promise<SlackControlResponse> {
  const query = input.tokens.join(" ");
  const competitor = findCompetitor(await input.store.listCompetitors(), query);
  if (!competitor) return renderTechnicalHelp(`Could not find competitor: ${query || "(empty)"}`);
  if (!input.technicalResearch) {
    const cached = await input.store.getLatestTechnicalBrief(competitor.id);
    return cached ? renderTechnicalBrief(competitor, cached, false) : renderTechnicalUnavailable();
  }
  const result = await input.technicalResearch({ store: input.store, competitor, forceRefresh });
  return renderTechnicalBrief(competitor, result.brief, result.refreshed || forceRefresh);
}

async function handleCompare(input: TechnicalCommandInput): Promise<SlackControlResponse> {
  const [leftQuery, rightQuery] = input.tokens;
  if (!leftQuery || !rightQuery) return renderTechnicalHelp("Compare needs two competitors, for example: `/competitor compare zip.com coupa.com`.");
  const competitors = await input.store.listCompetitors();
  const left = findCompetitor(competitors, leftQuery);
  const right = findCompetitor(competitors, rightQuery);
  if (!left || !right) return renderTechnicalHelp("Could not find both competitors. Try `/competitor list all` first.");
  const leftBrief = await getBriefForCompare(input, left);
  const rightBrief = await getBriefForCompare(input, right);
  if (!leftBrief || !rightBrief) return renderTechnicalUnavailable();
  return renderTechnicalComparison({ competitor: left, brief: leftBrief }, { competitor: right, brief: rightBrief });
}

async function handleAsk(input: TechnicalCommandInput): Promise<SlackControlResponse> {
  const [query, ...questionParts] = input.tokens;
  const question = questionParts.join(" ").trim();
  if (!query || !question) {
    return renderTechnicalHelp("Ask needs a competitor and question, for example: `/competitor ask ziphq.com \"How do they use AI in intake approvals?\"`.");
  }
  const competitor = findCompetitor(await input.store.listCompetitors(), query);
  if (!competitor) return renderTechnicalHelp(`Could not find competitor: ${query}`);
  if (!input.questionAnswer) return renderQuestionUnavailable();
  const answer = await input.questionAnswer({ store: input.store, competitor, question });
  return renderQuestionAnswer(competitor, answer);
}

async function getBriefForCompare(input: TechnicalCommandInput, competitor: Competitor) {
  if (input.technicalResearch) {
    return (await input.technicalResearch({ store: input.store, competitor, forceRefresh: false })).brief;
  }
  return input.store.getLatestTechnicalBrief(competitor.id);
}

async function handleEvidence(store: Store, tokens: string[]): Promise<SlackControlResponse> {
  const maybeClaimType = tokens.find((token): token is EvidenceClaimType => claimTypes.has(token as EvidenceClaimType));
  const query = tokens.filter((token) => token !== maybeClaimType).join(" ");
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderTechnicalHelp(`Could not find competitor: ${query || "(empty)"}`);
  const evidence = (await store.listEvidenceForCompetitor(competitor.id)).filter((item) => !maybeClaimType || item.claimType === maybeClaimType);
  return renderEvidenceList(competitor, evidence, maybeClaimType ? `${maybeClaimType.replace(/_/g, " ")} evidence` : "Evidence");
}

async function handleUnknowns(store: Store, query: string): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderTechnicalHelp(`Could not find competitor: ${query || "(empty)"}`);
  const evidence = (await store.listEvidenceForCompetitor(competitor.id)).filter((item) => item.stance === "unknown");
  return renderEvidenceList(competitor, evidence, "Unknowns");
}

function isResearchDepth(value: string): value is IntelConfig["researchDepth"] {
  return value === "light" || value === "standard" || value === "deep";
}

function isBriefAudience(value: string): value is IntelConfig["briefAudience"] {
  return value === "founder" || value === "sales" || value === "product" || value === "technical";
}

function isCadence(value: string): value is IntelConfig["cadence"] {
  return value === "daily" || value === "weekly" || value === "manual";
}
