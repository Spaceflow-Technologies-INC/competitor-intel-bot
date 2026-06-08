import { pathToFileURL } from "node:url";

import Fastify from "fastify";

import { loadConfig } from "./config.js";
import { runCollectionJob, type CollectionResult } from "./jobs/run-collection.js";
import { runDailyDigestJob, type DigestResult } from "./jobs/run-digest.js";

export type ServerDeps = {
  runCollection: () => Promise<CollectionResult>;
  runDailyDigest: () => Promise<DigestResult>;
};

export function buildServer(deps: ServerDeps) {
  const server = Fastify({ logger: false });

  server.get("/ping", async (_request, reply) => reply.type("text/plain").send("PONG"));
  server.post("/jobs/collect", async () => deps.runCollection());
  server.post("/jobs/daily-digest", async () => deps.runDailyDigest());

  return server;
}

const directRunUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === directRunUrl) {
  const config = loadConfig();
  const server = buildServer({
    runCollection: runCollectionJob,
    runDailyDigest: runDailyDigestJob
  });

  await server.listen({ port: config.port, host: "0.0.0.0" });
}
