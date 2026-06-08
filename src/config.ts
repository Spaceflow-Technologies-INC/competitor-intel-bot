import { z } from "zod";

import type { CompetitorCategory, SeedCompetitor } from "./types.js";

const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_CHANNEL_ID: z.string().min(1),
  DATABASE_URL: z.string().startsWith("postgres://").or(z.string().startsWith("postgresql://")),
  COMPETITOR_SEEDS: z.string().default(""),
  PORT: z.string().default("8080"),
  DAILY_DIGEST_HOUR_UTC: z.string().default("16"),
  WEEKLY_DIGEST_DAY_UTC: z.string().default("1"),
  ALERT_SCORE_THRESHOLD: z.string().default("0.75"),
  PARALLEL_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini")
});

export type AppConfig = {
  port: number;
  slack: {
    botToken: string;
    channelId: string;
  };
  database: {
    url: string;
  };
  seedCompetitors: SeedCompetitor[];
  scheduler: {
    dailyDigestHourUtc: number;
    weeklyDigestDayUtc: number;
  };
  scoring: {
    alertThreshold: number;
  };
  optionalApis: {
    parallelApiKey?: string;
    openAi?: { apiKey: string; model: string };
  };
};

const categories = new Set<CompetitorCategory>([
  "procurement_ai",
  "sourcing_automation",
  "supplier_intelligence",
  "erp_procurement",
  "workflow_agent",
  "adjacent"
]);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const optionalApis: AppConfig["optionalApis"] = {};
  if (parsed.PARALLEL_API_KEY) {
    optionalApis.parallelApiKey = parsed.PARALLEL_API_KEY;
  }
  if (parsed.OPENAI_API_KEY) {
    optionalApis.openAi = { apiKey: parsed.OPENAI_API_KEY, model: parsed.OPENAI_MODEL };
  }

  return {
    port: parseInteger(parsed.PORT, "PORT"),
    slack: {
      botToken: parsed.SLACK_BOT_TOKEN,
      channelId: parsed.SLACK_CHANNEL_ID
    },
    database: {
      url: parsed.DATABASE_URL
    },
    seedCompetitors: parseSeedCompetitors(parsed.COMPETITOR_SEEDS),
    scheduler: {
      dailyDigestHourUtc: parseInteger(parsed.DAILY_DIGEST_HOUR_UTC, "DAILY_DIGEST_HOUR_UTC"),
      weeklyDigestDayUtc: parseInteger(parsed.WEEKLY_DIGEST_DAY_UTC, "WEEKLY_DIGEST_DAY_UTC")
    },
    scoring: {
      alertThreshold: parseNumber(parsed.ALERT_SCORE_THRESHOLD, "ALERT_SCORE_THRESHOLD")
    },
    optionalApis
  };
}

function parseSeedCompetitors(value: string): SeedCompetitor[] {
  if (!value.trim()) {
    return [];
  }
  return value.split(";").map((row) => {
    const [name, url, category] = row.split("|").map((item) => item.trim());
    if (!name || !url || !category || !categories.has(category as CompetitorCategory)) {
      throw new Error("COMPETITOR_SEEDS rows must use name|url|category");
    }
    return {
      name,
      domain: normalizeDomain(url),
      category: category as CompetitorCategory
    };
  });
}

function normalizeDomain(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).hostname.replace(/^www\./i, "");
}

function parseInteger(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function parseNumber(value: string, name: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }
  return parsed;
}
