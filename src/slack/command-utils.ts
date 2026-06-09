export function tokenize(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"|'([^']+)'|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3] ?? "").filter(Boolean);
}

export function isDomainLike(value: string): boolean {
  try {
    return normalizeDomain(value).includes(".");
  } catch {
    return false;
  }
}

export function normalizeDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
}

export function parsePriority(tokens: string[]): number | undefined {
  const token = tokens.find(isPriorityToken);
  if (!token) return undefined;
  return Number.parseInt(token.toLowerCase().replace(/^priority=/, "").replace(/^p/, ""), 10);
}

export function isPriorityToken(token: string): boolean {
  return /^p[1-9]$/i.test(token) || /^priority=[1-9]$/i.test(token);
}

export function titleizeDomain(domain: string): string {
  return normalizeDomain(domain).split(".")[0]?.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? domain;
}

export function normalizeScheduleTime(value: string): string | undefined {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number.parseInt(match[1] ?? "", 10);
  const minute = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return undefined;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function shouldDiscoverDomain(domain: string): boolean {
  return ["linkedin.com", "crunchbase.com", "g2.com", "capterra.com"].some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}
