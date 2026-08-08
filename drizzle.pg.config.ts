import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema/pg.ts",
  out: "./lib/db/migrations/pg",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://zavu_inbox:zavu_inbox@localhost:5432/zavu_inbox",
  },
} satisfies Config;
