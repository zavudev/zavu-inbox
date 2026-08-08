import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { createClient } from "@libsql/client";
import postgres from "postgres";
import { DIALECT } from "./dialect";
import * as sqliteSchema from "./schema/sqlite";
import * as pgSchema from "./schema/pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env. Use file:./zavu-inbox.db for " +
      "local SQLite, libsql://... for Turso, or postgres://... for Postgres."
  );
}

// Next dev reloads modules on every edit; without the global the pool grows
// until the server refuses connections.
const globalForDb = globalThis as unknown as {
  zavuInboxDb?: ReturnType<typeof createDb>;
};

function createDb() {
  if (DIALECT === "postgres") {
    const client = postgres(connectionString!, { max: 10, prepare: false });
    return drizzlePg(client, { schema: pgSchema });
  }

  // One driver covers both local SQLite (file:) and Turso (libsql:), so the
  // laptop and production run the same code path.
  const client = createClient({
    url: connectionString!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return drizzleLibsql(client, { schema: sqliteSchema });
}

/**
 * The database handle, typed against the SQLite schema for both backends.
 *
 * The row shapes are identical by construction and enforced by
 * `schema/parity.test.ts`; see `schema/index.ts` for why the cast lives here
 * and nowhere else.
 */
export const db = (globalForDb.zavuInboxDb ??
  createDb()) as unknown as ReturnType<typeof drizzleLibsql<typeof sqliteSchema>>;

if (process.env.NODE_ENV !== "production") {
  globalForDb.zavuInboxDb = db as unknown as ReturnType<typeof createDb>;
}

export { DIALECT };
export * as schema from "./schema";
