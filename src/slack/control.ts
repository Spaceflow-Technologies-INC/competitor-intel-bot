import { buildSeedSources } from "../competitors/seed.js";
import type { Competitor, CompetitorCategory, SlackMessage } from "../types.js";
import type { Store } from "../storage/memory-store.js";

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
  if (command === "help" || command === "") {
    return renderHelp();
  }
  if (command === "list") {
    return renderCompetitorList(await input.store.listCompetitors(), tokens.includes("all"));
  }
  if (command === "add") {
    return addCompetitor(input.store, tokens, input.userName);
  }
  if (command === "archive" || command === "remove") {
    return archiveCompetitor(input.store, tokens.join(" "), input.userName);
  }
  if (command === "run" && (tokens[0]?.toLowerCase() === "now" || tokens.length === 0)) {
    void input.triggerDigest?.().catch(() => undefined);
    return controlResponse({
      responseType: "in_channel",
      text: "Manual intel run started. Results will land in this channel when the scan finishes.",
      blocks: [
        header("Manual intel run started"),
        section("Collection and digest generation are running now. The final report will post as a normal channel digest.")
      ]
    });
  }
  return renderHelp(`Unknown command: ${command}`);
}

async function addCompetitor(store: Store, tokens: string[], userName: string | undefined): Promise<SlackControlResponse> {
  const parsed = parseAddCommand(tokens);
  if ("error" in parsed) {
    return parsed.error;
  }
  const competitor = await store.upsertCompetitor({
    name: parsed.name,
    canonicalDomain: parsed.domain,
    status: "approved",
    category: parsed.category,
    similarityScore: 0.82,
    monitoringPriority: parsed.priority
  });
  for (const source of buildSeedSources({ name: competitor.name, domain: competitor.canonicalDomain, category: competitor.category })) {
    await store.upsertSource({ competitorId: competitor.id, sourceType: source.sourceType, url: source.url, enabled: true });
  }
  const actor = userName ? ` by ${userName}` : "";
  return controlResponse({
    responseType: "in_channel",
    text: `${competitor.name} added to competitor monitoring${actor}.`,
    blocks: [
      header("Competitor added"),
      fields([
        ["Name", competitor.name],
        ["Domain", `<https://${competitor.canonicalDomain}|${competitor.canonicalDomain}>`],
        ["Category", competitor.category],
        ["Priority", `P${competitor.monitoringPriority}`]
      ]),
      context(`Added${actor}. It will be included in the next scheduled intel scan.`)
    ]
  });
}

async function archiveCompetitor(store: Store, query: string, userName: string | undefined): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) {
    return renderHelp(`Could not find competitor: ${query || "(empty)"}`);
  }
  const archived = await store.updateCompetitorStatus({ id: competitor.id, status: "archived" });
  const actor = userName ? ` by ${userName}` : "";
  return controlResponse({
    responseType: "in_channel",
    text: `${archived.name} archived from competitor monitoring${actor}.`,
    blocks: [
      header("Competitor archived"),
      fields([
        ["Name", archived.name],
        ["Domain", `<https://${archived.canonicalDomain}|${archived.canonicalDomain}>`],
        ["Status", archived.status],
        ["History", "Signals kept"]
      ]),
      context(`Archived${actor}. Existing history stays in the intel database.`)
    ]
  });
}

function parseAddCommand(tokens: string[]): { name: string; domain: string; category: CompetitorCategory; priority: number } | { error: SlackControlResponse } {
  const domainIndex = tokens.findIndex(isDomainLike);
  if (domainIndex === -1) {
    return { error: renderHelp("Add command needs a domain, for example: `/intel add coupa.com Coupa procurement_ai`.") };
  }
  const categoryIndex = tokens.findIndex(isCategory);
  if (categoryIndex === -1 && tokens.length >= 3) {
    const last = tokens[tokens.length - 1];
    if (last && !isDomainLike(last) && !isPriorityToken(last)) {
      return { error: renderUnknownCategory(last) };
    }
  }
  const category = categoryIndex === -1 ? "procurement_ai" : (tokens[categoryIndex] as CompetitorCategory);
  const priority = parsePriority(tokens) ?? 1;
  const name = tokens
    .filter((_, index) => index !== domainIndex && index !== categoryIndex)
    .filter((token) => !isPriorityToken(token))
    .join(" ")
    .trim();
  return {
    name: name || titleizeDomain(tokens[domainIndex] ?? ""),
    domain: normalizeDomain(tokens[domainIndex] ?? ""),
    category,
    priority
  };
}

function renderCompetitorList(competitors: Competitor[], includeAll: boolean): SlackControlResponse {
  const visible = competitors.filter((competitor) => includeAll || activeStatuses.has(competitor.status));
  if (visible.length === 0) {
    return renderHelp("No active competitors yet.");
  }
  const blocks: SlackControlResponse["blocks"] = [header(includeAll ? "All competitors" : "Active competitors")];
  for (const chunk of chunked(visible, 5)) {
    blocks.push({
      type: "section",
      fields: chunk.flatMap((competitor) => [
        markdown(`*${competitor.name}*\n<https://${competitor.canonicalDomain}|${competitor.canonicalDomain}>`),
        markdown(`*${competitor.category}*\n${competitor.status} • P${competitor.monitoringPriority}`)
      ])
    });
  }
  blocks.push(actions());
  return controlResponse({
    responseType: "ephemeral",
    text: `${visible.length} competitors listed.`,
    blocks
  });
}

function renderHelp(prefix?: string): SlackControlResponse {
  const examples = [
    "`/intel list`",
    "`/intel add coupa.com Coupa procurement_ai`",
    '`/intel add "SAP Ariba" ariba.com erp_procurement`',
    "`/intel archive coupa.com`",
    "`/intel run now`"
  ].join("\n");
  const blocks = [
    header("Competitor Intel control"),
    section([prefix, "Manage monitoring from Slack without code changes.", examples].filter(Boolean).join("\n\n")),
    section(`Categories: ${categories.map((category) => `\`${category}\``).join(", ")}`),
    actions()
  ];
  return controlResponse({ responseType: "ephemeral", text: prefix ?? "Competitor Intel commands", blocks });
}

function renderUnknownCategory(value: string): SlackControlResponse {
  return renderHelp(`Unknown category: ${value}. Use one of: ${categories.join(", ")}.`);
}

function findCompetitor(competitors: Competitor[], query: string): Competitor | undefined {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }
  const domain = isDomainLike(trimmed) ? normalizeDomain(trimmed) : "";
  return competitors.find((competitor) => {
    const name = competitor.name.toLowerCase();
    return competitor.canonicalDomain === domain || name === trimmed || name.includes(trimmed);
  });
}

function controlResponse(input: {
  responseType: SlackControlResponse["response_type"];
  text: string;
  blocks: SlackControlResponse["blocks"];
}): SlackControlResponse {
  return { response_type: input.responseType, text: input.text, blocks: input.blocks };
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;
  for (const match of text.matchAll(pattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens.filter(Boolean);
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
  if (!token) {
    return undefined;
  }
  const value = token.toLowerCase().replace(/^priority=/, "").replace(/^p/, "");
  return Number.parseInt(value, 10);
}

function isPriorityToken(token: string): boolean {
  return /^p[1-9]$/i.test(token) || /^priority=[1-9]$/i.test(token);
}

function titleizeDomain(domain: string): string {
  return normalizeDomain(domain).split(".")[0]?.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? domain;
}

function header(text: string): Record<string, unknown> {
  return { type: "header", text: { type: "plain_text", text } };
}

function section(text: string): Record<string, unknown> {
  return { type: "section", text: markdown(text) };
}

function fields(rows: Array<[string, string]>): Record<string, unknown> {
  return { type: "section", fields: rows.map(([label, value]) => markdown(`*${label}*\n${value}`)) };
}

function context(text: string): Record<string, unknown> {
  return { type: "context", elements: [markdown(text)] };
}

function actions(): Record<string, unknown> {
  return {
    type: "actions",
    elements: [
      button("List competitors", "intel_list", "list"),
      button("Run scan", "intel_run_now", "run now", "primary")
    ]
  };
}

function button(text: string, actionId: string, value: string, style?: "primary"): Record<string, unknown> {
  return { type: "button", text: { type: "plain_text", text }, action_id: actionId, value, ...(style ? { style } : {}) };
}

function markdown(text: string): Record<string, unknown> {
  return { type: "mrkdwn", text };
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
