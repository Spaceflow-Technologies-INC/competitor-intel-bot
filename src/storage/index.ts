import type { AppConfig } from "../config.js";
import type { Store } from "./memory-store.js";
import { PostgresStore } from "./postgres-store.js";

export async function createStore(config: AppConfig["database"]): Promise<Store> {
  const store = new PostgresStore(config.url);
  await store.migrate();
  return store;
}
