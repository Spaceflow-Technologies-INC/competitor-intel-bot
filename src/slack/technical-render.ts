import type { Competitor, IntelConfig, TechnicalBrief, TechnicalEvidenceItem } from "../types.js";
import type { TechnicalSourcePlan } from "../technical/source-graph.js";
import { actions, button, chunked, context, fields, formatPercent, header, labelValue, section, slackLink } from "./blocks.js";

export type SlackControlResponse = {
  response_type: "ephemeral" | "in_channel";
  text: string;
  blocks: Array<Record<string, unknown>>;
  replace_original?: boolean;
};

export function renderOnboarding(config: IntelConfig, updated = false): SlackControlResponse {
  return {
    response_type: "ephemeral",
    text: updated ? "Competitor onboarding updated." : "Competitor onboarding.",
    blocks: [
      header(updated ? "Competitor onboarding updated" : "Competitor onboarding"),
      fields([
        ["Research depth", config.researchDepth],
        ["Brief audience", config.briefAudience],
        ["Cadence", config.cadence],
        ["Categories", config.categories.map((category) => `\`${category}\``).join(", ")]
      ]),
      section("Set it with `/competitor onboard depth deep audience technical cadence weekly`. Technical briefs will separate evidence, inference, and unknowns."),
      actions([
        button("Deep research", "intel_onboard_deep", "onboard depth deep audience technical cadence weekly", "primary"),
        button("Standard", "intel_onboard_standard", "onboard depth standard audience technical cadence weekly")
      ])
    ]
  };
}

export function renderSourceGraph(competitor: Competitor, plan: TechnicalSourcePlan): SlackControlResponse {
  const rows = plan.targets.slice(0, 12).map((target) => [
    labelValue(target.sourceType),
    target.url ? slackLink(target.url, target.url.replace(/^https?:\/\//, "")) : target.searchQuery
  ] as [string, string]);
  return {
    response_type: "ephemeral",
    text: `${competitor.name} technical source graph.`,
    blocks: [
      header(`${competitor.name} source graph`),
      fields([["Objective", plan.objective], ["Queries", plan.searchQueries.slice(0, 3).map((query) => `\`${query}\``).join("\n")]]),
      ...chunked(rows, 4).map((chunk) => fields(chunk)),
      actions([button("Refresh brief", "intel_refresh_technical", `refresh ${competitor.canonicalDomain}`, "primary")])
    ]
  };
}

export function renderTechnicalBrief(competitor: Competitor, brief: TechnicalBrief, refreshed: boolean): SlackControlResponse {
  return {
    response_type: "in_channel",
    text: `${competitor.name} technical brief${refreshed ? " refreshed" : ""}.`,
    blocks: [
      header(brief.title),
      fields([
        ["Confidence", formatPercent(brief.confidence)],
        ["Evidence", `${brief.evidenceCount} claims`],
        ["Unknowns", `${brief.unknownCount}`],
        ["Generated", brief.createdAt.slice(0, 16).replace("T", " ")]
      ]),
      section(brief.executiveSummary),
      section(brief.markdown),
      actions([
        button("Refresh", "intel_refresh_technical", `refresh ${competitor.canonicalDomain}`, "primary"),
        button("Evidence", "intel_evidence", `evidence ${competitor.canonicalDomain}`),
        button("Unknowns", "intel_unknowns", `unknowns ${competitor.canonicalDomain}`)
      ])
    ]
  };
}

export function renderEvidenceList(competitor: Competitor, evidence: TechnicalEvidenceItem[], title = "Evidence"): SlackControlResponse {
  const blocks: SlackControlResponse["blocks"] = [header(`${competitor.name} ${title.toLowerCase()}`)];
  if (evidence.length === 0) {
    blocks.push(section("No matching technical evidence captured yet."));
  } else {
    for (const chunk of chunked(evidence.slice(0, 10), 5)) {
      blocks.push(section(chunk.map((item) => `*${labelValue(item.stance)} · ${item.label}* · ${formatPercent(item.confidence)}\n${item.summary}\n${slackLink(item.sourceUrl, item.sourceType)}`).join("\n\n")));
    }
  }
  blocks.push(actions([button("Refresh brief", "intel_refresh_technical", `refresh ${competitor.canonicalDomain}`, "primary")]));
  return {
    response_type: "ephemeral",
    text: `${competitor.name} ${title.toLowerCase()}.`,
    blocks
  };
}

export function renderTechnicalComparison(left: { competitor: Competitor; brief: TechnicalBrief }, right: { competitor: Competitor; brief: TechnicalBrief }): SlackControlResponse {
  return {
    response_type: "in_channel",
    text: `Technical comparison: ${left.competitor.name} vs ${right.competitor.name}.`,
    blocks: [
      header("Technical comparison"),
      fields([
        [left.competitor.name, `${left.brief.executiveSummary}\nConfidence: ${formatPercent(left.brief.confidence)} · Unknowns: ${left.brief.unknownCount}`],
        [right.competitor.name, `${right.brief.executiveSummary}\nConfidence: ${formatPercent(right.brief.confidence)} · Unknowns: ${right.brief.unknownCount}`]
      ]),
      context("Use `/competitor evidence <domain>` and `/competitor unknowns <domain>` to inspect claims behind this comparison.")
    ]
  };
}

export function renderTechnicalUnavailable(): SlackControlResponse {
  return {
    response_type: "ephemeral",
    text: "Technical research is not configured.",
    blocks: [header("Technical research unavailable"), section("Configure `PARALLEL_API_KEY` for source discovery. OpenAI is optional; deterministic brief synthesis still works without it.")]
  };
}

export function renderTechnicalHelp(message: string): SlackControlResponse {
  return {
    response_type: "ephemeral",
    text: message,
    blocks: [header("Technical competitor intelligence"), section(message)]
  };
}
