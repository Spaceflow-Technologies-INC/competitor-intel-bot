import { DeterministicSummarizer, OpenAISignalSummarizer, type SignalSummarizer } from "../ai/openai-summary.js";
import { loadConfig } from "../config.js";
import { SlackClient } from "../slack/client.js";
import { renderMorningIntelDigestMessage } from "../slack/render.js";
import { ParallelClient } from "../sources/parallel-client.js";
import { createStore } from "../storage/index.js";
import type { Store } from "../storage/memory-store.js";
import { collectIntel, type CollectionResult } from "./run-collection.js";

export type DigestResult = {
  postedSignals: number;
  collectedSignals?: number;
};

export async function runDailyDigestJob(): Promise<DigestResult> {
  const config = loadConfig();
  const store = await createStore(config.database);
  try {
    let collection: CollectionResult | undefined;
    if (config.optionalApis.parallelApiKey) {
      collection = await collectIntel({
        store,
        seeds: config.seedCompetitors,
        sourceClient: new ParallelClient({ apiKey: config.optionalApis.parallelApiKey }),
        fetchedAt: new Date().toISOString(),
        alertThreshold: config.scoring.alertThreshold
      });
    }
    return await runMorningDigest({
      store,
      channelId: config.slack.channelId,
      slack: new SlackClient({ token: config.slack.botToken }),
      summarizer: config.optionalApis.openAi
        ? new OpenAISignalSummarizer({
            apiKey: config.optionalApis.openAi.apiKey,
            model: config.optionalApis.openAi.model,
            fallback: new DeterministicSummarizer()
          })
        : new DeterministicSummarizer(),
      collectedSignals: collection?.storedSignals ?? 0
    });
  } finally {
    await closeStore(store);
  }
}

export type MorningDigestInput = {
  store: Store;
  channelId: string;
  slack: { postMessage(channel: string, message: ReturnType<typeof renderMorningIntelDigestMessage>): Promise<unknown> };
  summarizer: SignalSummarizer;
  collectedSignals?: number;
};

export async function runMorningDigest(input: MorningDigestInput): Promise<DigestResult> {
  const signals = await input.store.listUnpostedSignals(8);
  const summary = await input.summarizer.summarize(signals);
  await input.slack.postMessage(input.channelId, renderMorningIntelDigestMessage(signals, summary));
  await input.store.markSignalsPosted(signals.map((signal) => signal.id));
  return input.collectedSignals === undefined
    ? { postedSignals: signals.length }
    : { postedSignals: signals.length, collectedSignals: input.collectedSignals };
}

async function closeStore(store: Store): Promise<void> {
  if ("close" in store && typeof store.close === "function") {
    await store.close();
  }
}
