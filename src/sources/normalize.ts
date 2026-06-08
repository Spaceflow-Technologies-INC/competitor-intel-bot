import { createHash, randomUUID } from "node:crypto";

import type { SourceSnapshot } from "../types.js";

export type NormalizeSnapshotInput = {
  sourceId: string;
  url: string;
  title: string;
  body: string;
  fetchedAt: string;
  metadata?: Record<string, unknown>;
};

export function normalizeSnapshot(input: NormalizeSnapshotInput): SourceSnapshot {
  const title = normalizeWhitespace(input.title);
  const body = normalizeWhitespace(input.body);
  return {
    id: randomUUID(),
    sourceId: input.sourceId,
    url: input.url,
    title,
    bodyExcerpt: body.slice(0, 1200),
    rawHash: sha256(`${input.title}\n${input.body}`),
    contentHash: sha256(`${title}\n${body}`),
    fetchedAt: input.fetchedAt,
    metadata: input.metadata ?? {}
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
