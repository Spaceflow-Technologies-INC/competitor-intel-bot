import type { IntelSignal, SlackMessage } from "../types.js";

const MAX_DIGEST_SIGNALS = 8;
const MAX_SOURCE_LINKS = 3;

export function renderSignalAlertMessage(signal: IntelSignal): SlackMessage {
  return {
    text: `Competitor signal: ${signal.claim}`,
    blocks: [
      header("Competitor signal"),
      context(`${labelSignalType(signal.signalType)} - score ${formatPercent(signal.compositeScore)}`),
      ...renderSignalCard(signal, 0, { includeDivider: false })
    ]
  };
}

export function renderDailyDigestMessage(signals: IntelSignal[]): SlackMessage {
  const label = signals.length === 1 ? "signal" : "signals";
  return {
    text: `Daily competitor intel digest: ${signals.length} ${label}`,
    blocks: [
      header("Daily competitor intel digest"),
      context(`${signals.length} ${label} ready for review`),
      ...(signals.length
        ? renderSignalCards(signals.slice(0, MAX_DIGEST_SIGNALS))
        : [section("No high-signal competitor movement today.")])
    ]
  };
}

export function renderMorningIntelDigestMessage(signals: IntelSignal[], summary: string): SlackMessage {
  const label = signals.length === 1 ? "signal" : "signals";
  const headline = `Morning competitor intel: ${signals.length} ${label}`;
  const visibleSignals = signals.slice(0, MAX_DIGEST_SIGNALS);
  return {
    text: headline,
    blocks: [
      header("Morning competitor intel"),
      context(`${signals.length} ${label} - 09:00 Europe/Istanbul - public web sources`),
      section(formatExecutiveRead(summary)),
      divider(),
      ...(visibleSignals.length
        ? renderSignalCards(visibleSignals)
        : [section("No high-signal competitor movement today.")]),
      context("Scores combine relevance, impact, confidence, and novelty. Review sources before changing battlecards.")
    ]
  };
}

function renderSignalCards(signals: IntelSignal[]): Array<Record<string, unknown>> {
  return signals.flatMap((signal, index) => renderSignalCard(signal, index, { includeDivider: index < signals.length - 1 }));
}

function renderSignalCard(
  signal: IntelSignal,
  index: number,
  options: { includeDivider?: boolean } = {}
): Array<Record<string, unknown>> {
  const includeDivider = options.includeDivider ?? false;
  const blocks: Array<Record<string, unknown>> = [
    section(`*${plainForMrkdwn(cleanClaim(signal))}*\n${plainForMrkdwn(signal.summary, 720)}`),
    fields([
      ["Signal", labelSignalType(signal.signalType)],
      ["Score", formatPercent(signal.compositeScore)],
      ["Confidence", formatPercent(signal.confidenceScore)],
      ["Implication", labelAction(signal.spaceflowImplication)],
      ["Next move", labelAction(signal.suggestedAction)]
    ]),
    sourceLinksBlock(signal.sourceUrls)
  ];
  if (includeDivider) {
    blocks.push(divider());
  }
  return blocks;
}

function formatExecutiveRead(summary: string): string {
  const lines = summaryLines(summary).slice(0, 4);
  const bullets = lines.length ? lines : ["No notable competitor movement found in today's public-source sweep."];
  return `*Executive read*\n${bullets.map((line) => `- ${plainForMrkdwn(line, 420)}`).join("\n")}`;
}

function header(text: string): Record<string, unknown> {
  return { type: "header", text: { type: "plain_text", text: truncate(text, 150) } };
}

function section(text: string): Record<string, unknown> {
  return { type: "section", text: { type: "mrkdwn", text: truncate(text, 2900) } };
}

function fields(items: Array<[string, string]>): Record<string, unknown> {
  return {
    type: "section",
    fields: items.map(([label, value]) => ({
      type: "mrkdwn",
      text: `*${plainForMrkdwn(label, 80)}*\n${plainForMrkdwn(value, 360)}`
    }))
  };
}

function context(text: string): Record<string, unknown> {
  return { type: "context", elements: [{ type: "mrkdwn", text: truncate(text, 1800) }] };
}

function divider(): Record<string, unknown> {
  return { type: "divider" };
}

function sourceLinksBlock(urls: string[]): Record<string, unknown> {
  const sourceLinks = urls.slice(0, MAX_SOURCE_LINKS).map((url, index) => slackLink(url, `Source ${index + 1}: ${domainLabel(url)}`));
  const suffix = urls.length > MAX_SOURCE_LINKS ? ` - ${urls.length - MAX_SOURCE_LINKS} more source${urls.length - MAX_SOURCE_LINKS === 1 ? "" : "s"}` : "";
  return context(sourceLinks.length ? `Sources: ${sourceLinks.join("  ")}${suffix}` : "Sources: no URL captured");
}

function slackLink(url: string, label: string): string {
  return `<${sanitizeUrl(url)}|${plainForMrkdwn(label, 75)}>`;
}

function sanitizeUrl(url: string): string {
  try {
    return new URL(url).toString().replace(/[<>\s]/g, "");
  } catch {
    return url.replace(/[<>\s]/g, "");
  }
}

function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "source";
  }
}

function cleanClaim(signal: IntelSignal): string {
  const prefix = `${signal.signalType}:`;
  return signal.claim.toLowerCase().startsWith(prefix)
    ? signal.claim.slice(prefix.length).trim()
    : signal.claim;
}

function summaryLines(summary: string): string[] {
  return summary
    .split(/\r?\n/)
    .map(cleanGeneratedLine)
    .filter((line) => line.length > 0)
    .flatMap(splitLongLine);
}

function cleanGeneratedLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\[([^\]]+)]\((https?:\/\/[^)]+)\)/g, "$1")
    .replace(/```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLongLine(line: string): string[] {
  if (line.length <= 180) {
    return [line];
  }
  const sentences = line.match(/[^.!?]+[.!?]+/g);
  return sentences?.map((sentence) => sentence.trim()).filter(Boolean) ?? [line];
}

function plainForMrkdwn(value: string, maxLength = 500): string {
  return truncate(cleanGeneratedLine(value).replace(/[*_~]/g, ""), maxLength)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function labelSignalType(value: string): string {
  return labelAction(value);
}

function labelAction(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part, index) => (index === 0 ? capitalize(part) : part))
    .join(" ");
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : value;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : value;
}
