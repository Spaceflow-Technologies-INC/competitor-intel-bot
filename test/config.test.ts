import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

const baseEnv = {
  SLACK_BOT_TOKEN: "xoxb-test",
  SLACK_CHANNEL_ID: "C123",
  DATABASE_URL: "postgres://user:pass@localhost:5432/intel",
  COMPETITOR_SEEDS: "ZipSource|https://zipsource.example|procurement_ai;BuyAI|https://buyai.example|sourcing_automation"
};

describe("loadConfig", () => {
  it("loads required runtime config", () => {
    const config = loadConfig(baseEnv);

    expect(config.slack.channelId).toBe("C123");
    expect(config.database.url).toBe("postgres://user:pass@localhost:5432/intel");
    expect(config.seedCompetitors).toHaveLength(2);
    expect(config.seedCompetitors[0]).toEqual({
      name: "ZipSource",
      domain: "zipsource.example",
      category: "procurement_ai"
    });
  });

  it("defaults scheduling and scoring thresholds", () => {
    const config = loadConfig(baseEnv);

    expect(config.scheduler.dailyDigestHourUtc).toBe(16);
    expect(config.scoring.alertThreshold).toBe(0.75);
  });

  it("loads Parallel and OpenAI API settings without generic search config", () => {
    const config = loadConfig({
      ...baseEnv,
      PARALLEL_API_KEY: "parallel-test",
      OPENAI_API_KEY: "openai-test",
      OPENAI_MODEL: "gpt-5-mini"
    });

    expect(config.optionalApis).toEqual({
      parallelApiKey: "parallel-test",
      openAi: { apiKey: "openai-test", model: "gpt-5-mini" }
    });
  });

  it("rejects invalid seed rows", () => {
    expect(() => loadConfig({
      ...baseEnv,
      COMPETITOR_SEEDS: "MissingParts"
    })).toThrow(/COMPETITOR_SEEDS/);
  });
});
