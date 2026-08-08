import type { Config } from "drizzle-kit";

// Default backend: Turso in production, a local file in development.
export default {
  schema: "./lib/db/schema/sqlite.ts",
  out: "./lib/db/migrations/sqlite",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:./zavu-inbox.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
