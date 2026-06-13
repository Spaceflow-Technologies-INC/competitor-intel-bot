import type { Competitor, CompetitorQuestionAnswer, QuestionAnswerPoint } from "../types.js";
import { actions, button, context, fields, formatPercent, header, section, slackLink } from "./blocks.js";
import type { SlackControlResponse } from "./technical-render.js";

export function renderQuestionAnswer(competitor: Competitor, answer: CompetitorQuestionAnswer): SlackControlResponse {
  return {
    response_type: "in_channel",
    text: `${competitor.name} answer: ${answer.shortAnswer}`,
    blocks: [
      header(`${competitor.name} answer`),
      fields([
        ["Question", answer.question],
        ["Confidence", formatPercent(answer.confidence)],
        ["Generated", answer.generatedAt.slice(0, 16).replace("T", " ")],
        ["Sources", `${answer.citations.length}`]
      ]),
      section(`*Short answer*\n${answer.shortAnswer}`),
      renderPoints("Evidence", answer.evidence),
      renderPoints("Inference", answer.inferences),
      renderPoints("Unknowns", answer.unknowns),
      renderCitations(answer),
      actions([
        button("Refresh brief", "intel_refresh_technical", `refresh ${competitor.canonicalDomain}`, "primary"),
        button("Evidence", "intel_evidence", `evidence ${competitor.canonicalDomain}`),
        button("Unknowns", "intel_unknowns", `unknowns ${competitor.canonicalDomain}`)
      ])
    ]
  };
}

export function renderQuestionUnavailable(): SlackControlResponse {
  return {
    response_type: "ephemeral",
    text: "Question research is not configured.",
    blocks: [header("Question research unavailable"), section("Configure `PARALLEL_API_KEY` for live question research. OpenAI is optional; deterministic answers still work after research pages are fetched.")]
  };
}

function renderPoints(title: string, points: QuestionAnswerPoint[]): Record<string, unknown> {
  if (points.length === 0) return section(`*${title}*\nNo matching ${title.toLowerCase()} found.`);
  return section([
    `*${title}*`,
    ...points.slice(0, 5).map((point) => {
      const source = point.sourceUrl ? `\n${slackLink(point.sourceUrl, "source")}` : "";
      return `*${point.label}* · ${formatPercent(point.confidence)}\n${point.summary}${source}`;
    })
  ].join("\n\n"));
}

function renderCitations(answer: CompetitorQuestionAnswer): Record<string, unknown> {
  if (answer.citations.length === 0) return context("Sources: none captured.");
  return context(`Sources: ${answer.citations.slice(0, 5).map((citation) => slackLink(citation.url, citation.title)).join("  ")}`);
}
