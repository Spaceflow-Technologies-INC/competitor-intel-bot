import type { Competitor, SlackMessage } from "../types.js";
import type { Store } from "../storage/memory-store.js";
import { fields, header, context, labelValue } from "./blocks.js";
import { isDomainLike, normalizeDomain } from "./command-utils.js";

type SlackControlResponse = SlackMessage & {
  response_type: "ephemeral" | "in_channel";
  replace_original?: boolean;
};

export async function updateCompetitorStatus(
  store: Store,
  query: string,
  userName: string | undefined,
  status: "approved" | "rejected" | "archived"
): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderMissingCompetitor(query);
  const updated = await store.updateCompetitorStatus({ id: competitor.id, status });
  const actor = userName ? ` by ${userName}` : "";
  return {
    response_type: "in_channel",
    text: `${updated.name} ${status}${actor}.`,
    blocks: [
      header(status === "approved" ? "Competitor approved" : status === "rejected" ? "Competitor rejected" : "Competitor archived"),
      fields([["Name", updated.name], ["Domain", `<https://${updated.canonicalDomain}|${updated.canonicalDomain}>`], ["Status", updated.status], ["History", "Signals kept"]]),
      context(`${labelValue(status)}${actor}. Existing history stays available in battlecards.`)
    ]
  };
}

export async function deleteCompetitorFromCommand(
  store: Store,
  query: string,
  userName: string | undefined
): Promise<SlackControlResponse> {
  const competitor = findCompetitor(await store.listCompetitors(), query);
  if (!competitor) return renderMissingCompetitor(query);
  const deleted = await store.deleteCompetitor(competitor.id);
  const actor = userName ? ` by ${userName}` : "";
  return {
    response_type: "in_channel",
    text: `${deleted.name} deleted${actor}.`,
    blocks: [
      header("Competitor deleted"),
      fields([["Name", deleted.name], ["Domain", `<https://${deleted.canonicalDomain}|${deleted.canonicalDomain}>`], ["Status", "Deleted"], ["History", "Signals detached"]]),
      context(`Deleted${actor}. Source monitoring was removed; historical signals stay in the intel archive without an active competitor link.`)
    ]
  };
}

export function findCompetitor(competitors: Competitor[], query: string): Competitor | undefined {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return undefined;
  const domain = isDomainLike(trimmed) ? normalizeDomain(trimmed) : "";
  return competitors.find((competitor) => competitor.canonicalDomain === domain || competitor.name.toLowerCase() === trimmed || competitor.name.toLowerCase().includes(trimmed));
}

function renderMissingCompetitor(query: string): SlackControlResponse {
  return {
    response_type: "ephemeral",
    text: `Could not find competitor: ${query || "(empty)"}`,
    blocks: [header("Competitor not found"), context("Try `/competitor list all` to see approved, candidate, rejected, and archived competitors.")]
  };
}
