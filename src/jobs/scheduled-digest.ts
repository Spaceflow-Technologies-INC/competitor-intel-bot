import { loadConfig } from "../config.js";
import { createStore } from "../storage/index.js";
import type { Store } from "../storage/memory-store.js";
import { runDailyDigestJob, type DigestResult } from "./run-digest.js";

export async function runScheduledDigestJob(): Promise<DigestResult & { skipped?: boolean; scheduledTime?: string }> {
  const config = loadConfig();
  const store = await createStore(config.database);
  try {
    const shouldRun = await shouldRunDigestAtScheduledTime({ store, now: new Date() });
    if (!shouldRun) {
      return { postedSignals: 0, skipped: true, scheduledTime: await getDailyDigestTime(store) };
    }
  } finally {
    await closeStore(store);
  }
  return runDailyDigestJob();
}

export async function shouldRunDigestAtScheduledTime(input: { store: Store; now: Date }): Promise<boolean> {
  const scheduled = await getDailyDigestTime(input.store);
  return formatIstanbulTime(input.now) === scheduled;
}

export async function getDailyDigestTime(store: Store): Promise<string> {
  return (await store.getSetting("daily_digest_time")) ?? "09:00";
}

function formatIstanbulTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

async function closeStore(store: Store): Promise<void> {
  if ("close" in store && typeof store.close === "function") {
    await store.close();
  }
}
