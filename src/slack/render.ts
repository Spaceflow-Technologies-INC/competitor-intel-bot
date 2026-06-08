import type { IntelSignal, SlackMessage } from "../types.js";

export function renderSignalAlertMessage(signal: IntelSignal): SlackMessage {
  return {
    text: `Competitor signal: ${signal.claim}`,
    blocks: [
      header("Competitor signal"),
      section(`*${signal.claim}*\n${signal.summary}`),
      fields([
        ["Type", signal.signalType],
        ["Score", signal.compositeScore.toFixed(2)],
        ["Confidence", signal.confidenceScore.toFixed(2)],
        ["Implication", signal.spaceflowImplication],
        ["Action", signal.suggestedAction]
      ]),
      section(`*Sources*\n${signal.sourceUrls.map((url, index) => `${index + 1}. ${url}`).join("\n")}`)
    ]
  };
}

export function renderDailyDigestMessage(signals: IntelSignal[]): SlackMessage {
  const label = signals.length === 1 ? "signal" : "signals";
  return {
    text: `Daily competitor intel digest: ${signals.length} ${label}`,
    blocks: [
      header("Daily competitor intel digest"),
      section(signals.length ? signals.map(formatDigestSignal).join("\n\n") : "No new competitor signals.")
    ]
  };
}

export function renderMorningIntelDigestMessage(signals: IntelSignal[], summary: string): SlackMessage {
  const label = signals.length === 1 ? "signal" : "signals";
  const headline = `Morning competitor intel: ${signals.length} ${label}`;
  return {
    text: headline,
    blocks: [
      header("Morning competitor intel"),
      section(summary),
      section(signals.length ? signals.map(formatDigestSignal).join("\n\n") : "No new high-signal competitor movement found."),
      context("Runs daily at 09:00 Europe/Istanbul. Sources are public web results.")
    ]
  };
}

function formatDigestSignal(signal: IntelSignal): string {
  return `*${signal.claim}*\nScore ${signal.compositeScore.toFixed(2)} · ${signal.suggestedAction}\n${signal.sourceUrls[0] ?? ""}`;
}

function header(text: string): Record<string, unknown> {
  return { type: "header", text: { type: "plain_text", text } };
}

function section(text: string): Record<string, unknown> {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function fields(items: Array<[string, string]>): Record<string, unknown> {
  return {
    type: "section",
    fields: items.map(([label, value]) => ({ type: "mrkdwn", text: `*${label}*\n${value}` }))
  };
}

function context(text: string): Record<string, unknown> {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}
