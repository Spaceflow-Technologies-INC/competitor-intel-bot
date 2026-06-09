import { buildSeedSources } from "../competitors/seed.js";
import { getDailyDigestTime } from "../jobs/scheduled-digest.js";
import { scoreSourceUrl } from "../signals/source-quality.js";
import type { Competitor, CompetitorCategory, SlackMessage } from "../types.js";
import type { SourceRecord, Store } from "../storage/memory-store.js";
import {
  actions,
  button,
  chunked,
  context,
  divider,
  fields,
  formatPercent,
  header,
  labelValue,
  markdown,
  section,
  slackLink
} from "./blocks.js";

export type SlackControlResponse = SlackMessage & {
  response_type: "ephemeral" | "in_channel";
  replace_original?: boolean;
};

export type IntelSlashCommandInput = {
  store: Store;
  text: string;
  userName?: string;
  triggerDigest?: () => Promise<unknown>;
};

const categories: CompetitorCategory[] = [
  "procurement_ai",
  "sourcing_automation",
  "supplier_intelligence",
  "erp_procurement",
  "workflow_agent",
  "adjacent"
];

const activeStatuses = new Set<Competitor["status"]>(["seeded", "approved", "candidate"]);

export async function handleIntelSlashCommand(input: IntelSlashCommandInput): Promise<SlackControlResponse> {
  const tokens = tokenize(input.text);
  const command = (tokens.shift() ?? "help").toLowerCase();
  if (command === "help" || command === "") return renderHelp();
  if (command === "list") return renderCompetitorList(await input.store.listCompetitors(), tokens.includes("all"));
  if (command === "add") return upsertCompetitorFromCommand(input.store, tokens, input.userName, "approved");
  if (command === "suggest" || command === "candidate") return upsertCompetitorFromCommand(input.store, tokens, input.userName, "candidate");
  if (command === "approve") return updateCompetitorStatus(input.store, tokens.join(" "), input.userName, "approved");
  if (command === "reject") return updateCompetitorStatus(input.store, tokens.join(" "), input.userName, "rejected");
  if (command === "archive" || command === "remove") return updateCompetitorStatus(input.store, tokens.join(" "), input.userName, "archived");
  if (command === "show" || command === "battlecard") return renderBattlecard(input.store, tokens.join(" "));
  if (command === "schedule") return handleScheduleCommand(input.store, tokens);
  if (command === "run" && (tokens[0]?.toLowerCase() === "now" || tokens.length === 0)) {
    void input.triggerDigest?.().catch(() => undefined);
    return controlResponse({
      responseType: "in_channel",
      text: "Manual intel run started. Results will land in this channel when the scan finishes.",
      blocks: [header("Manual intel run started"), section("Collection and digest generation are running now. The final report will post as a normal channel digest.")]
    });
  }
  return renderHelp(`Unknown command: ${command}`);
}

async function upsertCompetitorFromCommand(
  store: Store,
  tokens: string[],
  userName: string | undefined,
  status: "approved" | "candidate"
): Promise<SlackControlResponse> {
  const parsed = parseAddCommand(tokens);
  if ("error" in parsed) return parsed.error;
  const competitor = await store.upsertCompetitor({
    name: parsed.name,
    canonicalDomain: parsed.domain,
    status,
    category: parsed.category,
    similarityScore: status === "candidate" ? 0.68 : 0.82,
    monitoringPriority: parsed.priority
  });
  for (const source of buildSeedSources({ name: competitor.name, domain: competitor.canonicalDomain, category: competitor.category })) {
    await store.upsertSource({ competitorId: competitor.id, sourceType: source.sourceType, url: source.url, enabled: true });
  }
  const actor = userName ? ` by ${userName}` : "";
  return status === "candidate" ? renderCandidateApproval(competitor, actor) : renderCompetitorAdded(competitor, actor);
}

function renderCompetitorAdded(competitor: Competitor, actor: string): SlackControlResponse {
  return controlResponse({
    responseType: "in_channel",
    text: `${competitor.name} added to competitor monitoring${actor}.`,
    blocks: [
      header("Competitor added"),
      fields([["Name", competitor.name], ["Domain", `<https://${competitor.canonicalDomain}|${competitor.canonicalDomain}>`], ["Category", competitor.category], ["Priority", `P${competitor.monitoringPriority}`]]),
      context(`Added${actor}. It will be included in the next scheduled intel scan.`)
    ]
  });
}

function renderCandidateApproval(competitor: Competitor, actor: string): SlackControlResponse {
  return controlResponse({
    responseType: "in_channel",
    text: `${competitor.name} is waiting for competitor monitoring approval${actor}.`,
    blocks: [
      header("Competitor candidate"),
      fields([["Name", competitor.name], ["Domain", `<https://${competitor.canonicalDomain}|${competitor.canonicalDomain}>`], ["Category", competitor.category], ["Priority", `P${competitor.monitoringPriority}`]]),
      context(`Suggested${actor}. Approve to include it in monitoring, or reject to keep the history but stop scans.`),
      actions([
        button("Approve", "intel_approve_candidate", `approve ${competitor.canonicalDomain}`, "primary"),
        button("Reject", "intel_reject_candidate", `reject ${competitor.canonicalDomain}`, "danger"),
        button("Show profile", "intel_show_candidate", `show ${competitor.canonicalDomain}`)
      ])
    ]
  });
}

async function updateCompetitorStatus(
  store: Store,
  query: string,
  userName: string | undefined,
  status: "approved" | "rejected" | "archived"
): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderHelp(`Could not find competitor: ${query || "(empty)"}`);
  const updated = await store.updateCompetitorStatus({ id: competitor.id, status });
  const actor = userName ? ` by ${userName}` : "";
  return controlResponse({
    responseType: "in_channel",
    text: `${updated.name} ${status}${actor}.`,
    blocks: [
      header(status === "approved" ? "Competitor approved" : status === "rejected" ? "Competitor rejected" : "Competitor archived"),
      fields([["Name", updated.name], ["Domain", `<https://${updated.canonicalDomain}|${updated.canonicalDomain}>`], ["Status", updated.status], ["History", "Signals kept"]]),
      context(`${labelValue(status)}${actor}. Existing history stays available in battlecards.`)
    ]
  });
}

async function renderBattlecard(store: Store, query: string): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderHelp(`Could not find competitor: ${query || "(empty)"}`);
  const [sources, signals] = await Promise.all([store.listSourcesForCompetitor(competitor.id), store.listSignalsForCompetitor(competitor.id, 5)]);
  const quality = bestSourceQuality(sources, competitor.canonicalDomain);
  const topSignal = signals[0];
  const blocks: SlackControlResponse["blocks"] = [
    header(`${competitor.name} battlecard`),
    fields([["Domain", `<https://${competitor.canonicalDomain}|${competitor.canonicalDomain}>`], ["Category", competitor.category], ["Status", competitor.status], ["Priority", `P${competitor.monitoringPriority}`], ["Similarity", formatPercent(competitor.similarityScore)], ["Source quality", `${quality.label} · ${formatPercent(quality.score)}`]]),
    section(["*Battlecard*", `*What they are:* ${competitor.name} is tracked as ${labelValue(competitor.category).toLowerCase()} in the Spaceflow competitive map.`, `*Why it matters:* ${topSignal ? topSignal.summary : "No high-signal movement has been captured yet."}`, `*Next move:* ${topSignal ? topSignal.suggestedAction.replace(/_/g, " ") : "watch"}`].join("\n")),
    divider(),
    ...renderBattlecardSignals(signals),
    renderSourceSummary(sources, competitor.canonicalDomain),
    actions([button("Run scan", "intel_run_now", "run now", "primary"), button("Archive", "intel_archive", `archive ${competitor.canonicalDomain}`, "danger")])
  ];
  return controlResponse({ responseType: "ephemeral", text: `${competitor.name} battlecard`, blocks });
}

async function handleScheduleCommand(store: Store, tokens: string[]): Promise<SlackControlResponse> {
  const requested = tokens[0];
  if (!requested) {
    const current = await getDailyDigestTime(store);
    return controlResponse({
      responseType: "ephemeral",
      text: `Morning intel digest is scheduled for ${current} Europe/Istanbul.`,
      blocks: [header("Digest schedule"), section(`Current schedule: *${current}* Europe/Istanbul\nChange it with \`/intel schedule 08:30\`.`)]
    });
  }
  const normalized = normalizeScheduleTime(requested);
  if (!normalized) return renderHelp("Schedule must use HH:mm, for example: `/intel schedule 08:30`.");
  await store.setSetting("daily_digest_time", normalized);
  return controlResponse({
    responseType: "in_channel",
    text: `Morning intel digest moved to ${normalized} Europe/Istanbul.`,
    blocks: [header("Digest schedule updated"), fields([["Daily digest", `${normalized} Europe/Istanbul`], ["Control", "`/intel schedule HH:mm`"], ["Manual run", "`/intel run now`"], ["Status", "Saved"]]), context("The scheduler checks every minute and posts only when the stored time matches.")]
  });
}

function renderBattlecardSignals(signals: Awaited<ReturnType<Store["listSignalsForCompetitor"]>>): Array<Record<string, unknown>> {
  if (signals.length === 0) return [section("*Recent signals*\nNo captured signals yet.")];
  return [section(["*Recent signals*", ...signals.slice(0, 3).map((signal) => `*${labelValue(signal.signalType)}* · ${formatPercent(signal.compositeScore)}\n${signal.summary}\nNext: ${signal.suggestedAction.replace(/_/g, " ")}`)].join("\n\n"))];
}

function renderSourceSummary(sources: SourceRecord[], competitorDomain: string): Record<string, unknown> {
  if (sources.length === 0) return context("Sources: no source graph yet.");
  const links = sources.slice(0, 4).map((source) => `${slackLink(source.url, source.sourceType)} (${scoreSourceUrl(source.url, competitorDomain).label})`);
  return context(`Sources: ${links.join("  ")}`);
}

function bestSourceQuality(sources: SourceRecord[], competitorDomain: string) {
  return sources.map((source) => scoreSourceUrl(source.url, competitorDomain)).sort((a, b) => b.score - a.score)[0] ?? { label: "Weak" as const, score: 0.35 };
}

function parseAddCommand(tokens: string[]): { name: string; domain: string; category: CompetitorCategory; priority: number } | { error: SlackControlResponse } {
  const domainIndex = tokens.findIndex(isDomainLike);
  if (domainIndex === -1) return { error: renderHelp("Add command needs a domain, for example: `/intel add coupa.com Coupa procurement_ai`.") };
  const categoryIndex = tokens.findIndex(isCategory);
  if (categoryIndex === -1 && tokens.length >= 3) {
    const last = tokens[tokens.length - 1];
    if (last && !isDomainLike(last) && !isPriorityToken(last)) return { error: renderUnknownCategory(last) };
  }
  const category = categoryIndex === -1 ? "procurement_ai" : (tokens[categoryIndex] as CompetitorCategory);
  const name = tokens.filter((_, index) => index !== domainIndex && index !== categoryIndex).filter((token) => !isPriorityToken(token)).join(" ").trim();
  return { name: name || titleizeDomain(tokens[domainIndex] ?? ""), domain: normalizeDomain(tokens[domainIndex] ?? ""), category, priority: parsePriority(tokens) ?? 1 };
}

function renderCompetitorList(competitors: Competitor[], includeAll: boolean): SlackControlResponse {
  const visible = competitors.filter((competitor) => includeAll || activeStatuses.has(competitor.status));
  if (visible.length === 0) return renderHelp("No active competitors yet.");
  const blocks: SlackControlResponse["blocks"] = [header(includeAll ? "All competitors" : "Active competitors")];
  for (const chunk of chunked(visible, 5)) {
    blocks.push({ type: "section", fields: chunk.flatMap((competitor) => [markdown(`*${competitor.name}*\n<https://${competitor.canonicalDomain}|${competitor.canonicalDomain}>`), markdown(`*${competitor.category}*\n${competitor.status} - P${competitor.monitoringPriority}`)]) });
  }
  blocks.push(defaultActions());
  return controlResponse({ responseType: "ephemeral", text: `${visible.length} competitors listed.`, blocks });
}

function renderHelp(prefix?: string): SlackControlResponse {
  const examples = ["`/intel list`", "`/intel add coupa.com Coupa procurement_ai`", "`/intel suggest newco.ai NewCo procurement_ai`", "`/intel approve newco.ai`", "`/intel show coupa.com`", "`/intel schedule 08:30`", "`/intel archive coupa.com`", "`/intel run now`"].join("\n");
  const blocks = [header("Competitor Intel control"), section([prefix, "Manage monitoring from Slack without code changes.", examples].filter(Boolean).join("\n\n")), section(`Categories: ${categories.map((category) => `\`${category}\``).join(", ")}`), defaultActions()];
  return controlResponse({ responseType: "ephemeral", text: prefix ?? "Competitor Intel commands", blocks });
}

function renderUnknownCategory(value: string): SlackControlResponse {
  return renderHelp(`Unknown category: ${value}. Use one of: ${categories.join(", ")}.`);
}

function findCompetitor(competitors: Competitor[], query: string): Competitor | undefined {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return undefined;
  const domain = isDomainLike(trimmed) ? normalizeDomain(trimmed) : "";
  return competitors.find((competitor) => competitor.canonicalDomain === domain || competitor.name.toLowerCase() === trimmed || competitor.name.toLowerCase().includes(trimmed));
}

function controlResponse(input: { responseType: SlackControlResponse["response_type"]; text: string; blocks: SlackControlResponse["blocks"] }): SlackControlResponse {
  return { response_type: input.responseType, text: input.text, blocks: input.blocks };
}

function tokenize(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"|'([^']+)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "").filter(Boolean);
}

function isCategory(value: string): value is CompetitorCategory {
  return categories.includes(value as CompetitorCategory);
}

function isDomainLike(value: string): boolean {
  try {
    return normalizeDomain(value).includes(".");
  } catch {
    return false;
  }
}

function normalizeDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
}

function parsePriority(tokens: string[]): number | undefined {
  const token = tokens.find(isPriorityToken);
  if (!token) return undefined;
  return Number.parseInt(token.toLowerCase().replace(/^priority=/, "").replace(/^p/, ""), 10);
}

function isPriorityToken(token: string): boolean {
  return /^p[1-9]$/i.test(token) || /^priority=[1-9]$/i.test(token);
}

function titleizeDomain(domain: string): string {
  return normalizeDomain(domain).split(".")[0]?.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? domain;
}

function normalizeScheduleTime(value: string): string | undefined {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return undefined;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function defaultActions(): Record<string, unknown> {
  return actions([button("List competitors", "intel_list", "list"), button("Run scan", "intel_run_now", "run now", "primary")]);
}
