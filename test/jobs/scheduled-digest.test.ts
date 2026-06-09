import { describe, expect, it } from "vitest";

import { shouldRunDigestAtScheduledTime } from "../../src/jobs/scheduled-digest.js";
import { MemoryStore } from "../../src/storage/memory-store.js";

describe("scheduled digest gate", () => {
  it("runs when the Europe/Istanbul time matches the stored HH:mm schedule", async () => {
    const store = new MemoryStore();
    await store.setSetting("daily_digest_time", "08:30");

    await expect(
      shouldRunDigestAtScheduledTime({
        store,
        now: new Date("2026-06-09T05:30:00.000Z")
      })
    ).resolves.toBe(true);
  });

  it("skips when the stored schedule does not match", async () => {
    const store = new MemoryStore();
    await store.setSetting("daily_digest_time", "09:00");

    await expect(
      shouldRunDigestAtScheduledTime({
        store,
        now: new Date("2026-06-09T05:30:00.000Z")
      })
    ).resolves.toBe(false);
  });
});
