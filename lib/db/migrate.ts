import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { migrate as migrateLibsql } from "drizzle-orm/libsql/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { detectDialect } from "./dialect";

/**
 * Applies the migrations for whichever backend DATABASE_URL points at. Run with
 * `bun run db:migrate`; the container entrypoint runs the same logic on boot,
 * so a fresh start needs no manual step.
 */
export async function runMigrations(): Promise<"sqlite" | "postgres"> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const dialect = detectDialect(connectionString);

  if (dialect === "postgres") {
    const client = postgres(connectionString, { max: 1 });
    try {
      await migratePg(drizzlePg(client), {
        migrationsFolder: "./lib/db/migrations/pg",
      });
    } finally {
      await client.end();
    }
    return "postgres";
  }

  const client = createClient({
    url: connectionString,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  try {
    await migrateLibsql(drizzleLibsql(client), {
      migrationsFolder: "./lib/db/migrations/sqlite",
    });
  } finally {
    client.close();
  }
  return "sqlite";
}

// Only run when invoked directly, so importing this from the entrypoint does
// not migrate twice.
if (process.argv[1]?.includes("migrate")) {
  runMigrations()
    .then((dialect) => {
      console.log(`Migrations applied (${dialect}).`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
