import { pathToFileURL } from "node:url";

import Fastify, { type FastifyReply } from "fastify";

import { loadConfig } from "./config.js";
import { discoverCompetitor, type CompetitorDiscoveryQuery, type CompetitorDiscoveryResult } from "./competitors/discovery.js";
import { runCollectionJob, type CollectionResult } from "./jobs/run-collection.js";
import { runDailyDigestJob, type DigestResult } from "./jobs/run-digest.js";
import { runScheduledDigestJob } from "./jobs/scheduled-digest.js";
import { ParallelClient } from "./sources/parallel-client.js";
import { handleIntelSlashCommand } from "./slack/control.js";
import type { QuestionAnswerRunner, TechnicalResearchRunner } from "./slack/technical-control.js";
import { verifySlackRequest } from "./slack/signature.js";
import { createStore as createDatabaseStore } from "./storage/index.js";
import type { Store } from "./storage/memory-store.js";
import { OpenAITechnicalBriefSynthesizer } from "./technical/openai-technical-brief.js";
import { OpenAIQuestionAnswerer } from "./technical/openai-question-answer.js";
import { answerCompetitorQuestion } from "./technical/question-answer.js";
import { researchTechnicalBrief } from "./technical/research.js";

export type ServerDeps = {
  runCollection: () => Promise<CollectionResult>;
  runDailyDigest: () => Promise<DigestResult>;
  runScheduledDigest?: () => Promise<DigestResult & { skipped?: boolean; scheduledTime?: string }>;
  createStore?: () => Promise<Store>;
  discoverCompetitor?: (query: CompetitorDiscoveryQuery) => Promise<CompetitorDiscoveryResult | undefined>;
  technicalResearch?: TechnicalResearchRunner;
  questionAnswer?: QuestionAnswerRunner;
  slackSigningSecret?: string;
  enableJobEndpoints?: boolean;
  requireSlackSignature?: boolean;
};

export function buildServer(deps: ServerDeps) {
  const server = Fastify({ logger: false });

  server.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    const rawBody = typeof body === "string" ? body : body.toString("utf8");
    done(null, { rawBody, values: Object.fromEntries(new URLSearchParams(rawBody)) });
  });

  server.get("/ping", async (_request, reply) => reply.type("text/plain").send("PONG"));
  if (deps.enableJobEndpoints !== false) {
    server.post("/jobs/collect", async () => deps.runCollection());
    server.post("/jobs/daily-digest", async () => deps.runDailyDigest());
    server.post("/jobs/scheduled-digest", async () => (deps.runScheduledDigest ?? deps.runDailyDigest)());
  }
  server.post("/slack/commands", async (request, reply) => {
    const body = readFormBody(request.body);
    if (!isVerifiedSlackRequest(deps, request.headers, body.rawBody)) {
      return reply.code(401).send({ error: "invalid_slack_signature" });
    }
    return handleSlackCommand(deps, body.values, reply, false);
  });
  server.post("/slack/interactions", async (request, reply) => {
    const body = readFormBody(request.body);
    if (!isVerifiedSlackRequest(deps, request.headers, body.rawBody)) {
      return reply.code(401).send({ error: "invalid_slack_signature" });
    }
    const payload = parseInteractionPayload(body.values.payload);
    const values = payload.userName ? { text: payload.value, user_name: payload.userName } : { text: payload.value };
    return handleSlackCommand(deps, values, reply, true);
  });

  return server;
}

const directRunUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === directRunUrl) {
  const config = loadConfig();
  const discoveryClient = config.optionalApis.parallelApiKey ? new ParallelClient({ apiKey: config.optionalApis.parallelApiKey }) : undefined;
  const technicalSynthesizer = config.optionalApis.openAi
    ? new OpenAITechnicalBriefSynthesizer({
      apiKey: config.optionalApis.openAi.apiKey,
      model: config.optionalApis.openAi.model
    })
    : undefined;
  const questionAnswerer = config.optionalApis.openAi
    ? new OpenAIQuestionAnswerer({
      apiKey: config.optionalApis.openAi.apiKey,
      model: config.optionalApis.openAi.model
    })
    : undefined;
  const server = buildServer({
    runCollection: runCollectionJob,
    runDailyDigest: runDailyDigestJob,
    runScheduledDigest: runScheduledDigestJob,
    createStore: () => createDatabaseStore(config.database),
    ...(discoveryClient ? { discoverCompetitor: (query) => discoverCompetitor({ ...query, search: discoveryClient.search.bind(discoveryClient) }) } : {}),
    ...(discoveryClient ? {
      technicalResearch: ({ store, competitor, forceRefresh }) => researchTechnicalBrief({
        store,
        competitor,
        sourceClient: discoveryClient,
        ...(technicalSynthesizer ? { synthesizer: technicalSynthesizer } : {}),
        forceRefresh
      })
    } : {}),
    ...(discoveryClient ? {
      questionAnswer: ({ store, competitor, question }) => answerCompetitorQuestion({
        store,
        competitor,
        question,
        sourceClient: discoveryClient,
        ...(questionAnswerer ? { answerer: questionAnswerer } : {})
      })
    } : {}),
    enableJobEndpoints: config.runtime.enableJobEndpoints,
    requireSlackSignature: config.runtime.requireSlackSignature,
    ...(config.slack.signingSecret ? { slackSigningSecret: config.slack.signingSecret } : {})
  });

  await server.listen({ port: config.port, host: "0.0.0.0" });
}

type ParsedFormBody = {
  rawBody: string;
  values: Record<string, string>;
};

function readFormBody(body: unknown): ParsedFormBody {
  if (isRecord(body) && typeof body.rawBody === "string" && isRecord(body.values)) {
    return { rawBody: body.rawBody, values: body.values as Record<string, string> };
  }
  return { rawBody: "", values: {} };
}

async function handleSlackCommand(deps: ServerDeps, values: Record<string, string>, reply: FastifyReply, isInteraction: boolean) {
  if (!deps.createStore) {
    return reply.code(503).send({ error: "slack_control_not_configured" });
  }
  const store = await deps.createStore();
  try {
    const userName = values.user_name;
    const response = await handleIntelSlashCommand({
      store,
      text: values.text ?? "help",
      triggerDigest: deps.runDailyDigest,
      ...(deps.discoverCompetitor ? { discoverCompetitor: deps.discoverCompetitor } : {}),
      ...(deps.technicalResearch ? { technicalResearch: deps.technicalResearch } : {}),
      ...(deps.questionAnswer ? { questionAnswer: deps.questionAnswer } : {}),
      ...(userName ? { userName } : {})
    });
    return reply.send(isInteraction ? { ...response, replace_original: true } : response);
  } finally {
    await closeStore(store);
  }
}

function isVerifiedSlackRequest(deps: ServerDeps, headers: Record<string, unknown>, rawBody: string): boolean {
  if (!deps.slackSigningSecret) {
    return deps.requireSlackSignature !== true;
  }
  return verifySlackRequest({
    signingSecret: deps.slackSigningSecret,
    rawBody,
    timestamp: headerValue(headers["x-slack-request-timestamp"]),
    signature: headerValue(headers["x-slack-signature"])
  });
}

function parseInteractionPayload(value: string | undefined): { value: string; userName?: string } {
  if (!value) {
    return { value: "help" };
  }
  const payload = safeParseJson(value);
  const userName = isRecord(payload) && isRecord(payload.user) ? stringValue(payload.user.username) : undefined;
  const action = isRecord(payload) && Array.isArray(payload.actions) ? payload.actions[0] : undefined;
  const actionValue = isRecord(action) ? stringValue(action.value) : undefined;
  return { value: actionValue ?? "help", ...(userName ? { userName } : {}) };
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function headerValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function closeStore(store: Store): Promise<void> {
  if ("close" in store && typeof store.close === "function") {
    await store.close();
  }
}
