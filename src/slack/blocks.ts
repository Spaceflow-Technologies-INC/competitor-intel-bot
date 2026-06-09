export function header(text: string): Record<string, unknown> {
  return { type: "header", text: { type: "plain_text", text: truncate(text, 150) } };
}

export function section(text: string): Record<string, unknown> {
  return { type: "section", text: markdown(text) };
}

export function fields(rows: Array<[string, string]>): Record<string, unknown> {
  return { type: "section", fields: rows.map(([label, value]) => markdown(`*${label}*\n${value}`)) };
}

export function context(text: string): Record<string, unknown> {
  return { type: "context", elements: [markdown(text)] };
}

export function divider(): Record<string, unknown> {
  return { type: "divider" };
}

export function actions(elements: Array<Record<string, unknown>>): Record<string, unknown> {
  return { type: "actions", elements };
}

export function button(text: string, actionId: string, value: string, style?: "primary" | "danger"): Record<string, unknown> {
  return { type: "button", text: { type: "plain_text", text }, action_id: actionId, value, ...(style ? { style } : {}) };
}

export function markdown(text: string): Record<string, unknown> {
  return { type: "mrkdwn", text: truncate(text, 2900) };
}

export function slackLink(url: string, label: string): string {
  return `<${sanitizeUrl(url)}|${escapeMrkdwn(label)}>`;
}

export function escapeMrkdwn(value: string, maxLength = 500): string {
  return truncate(value, maxLength)
    .replace(/[*_~]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function labelValue(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part, index) => (index === 0 ? capitalize(part) : part))
    .join(" ");
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sanitizeUrl(url: string): string {
  try {
    return new URL(url).toString().replace(/[<>\s]/g, "");
  } catch {
    return url.replace(/[<>\s]/g, "");
  }
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}` : value;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...` : value;
}
