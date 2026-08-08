import { PgDialect } from "drizzle-orm/pg-core";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it, vi } from "vitest";
import * as pgSchema from "./schema/pg";
import * as sqliteSchema from "./schema/sqlite";

/**
 * The Postgres branch cannot be exercised against a real server here, so the
 * fragments are compiled with the actual dialect instead and inspected as the
 * driver would receive them. These two helpers are the only place the app
 * differs between backends, and getting them wrong fails silently: an empty
 * result set, not an error.
 */

const pg = new PgDialect();
const sqlite = new SQLiteAsyncDialect();

async function loadDialect(url: string) {
  vi.resetModules();
  process.env.DATABASE_URL = url;
  return import("./dialect");
}

describe("dialect helpers", () => {
  it("uses ILIKE and a jsonb cast on Postgres", async () => {
    const { likeInsensitive, jsonArrayContains, isPostgres } = await loadDialect(
      "postgres://user:pass@host:5432/db"
    );

    expect(isPostgres).toBe(true);

    const search = pg.sqlToQuery(
      likeInsensitive(pgSchema.conversations.lastMessageText, "%ana%")
    );
    expect(search.sql).toContain("ilike");

    const channel = pg.sqlToQuery(
      jsonArrayContains(pgSchema.conversations.channels, "whatsapp")
    );
    expect(channel.sql).toContain("::text like");
  });

  it("uses plain LIKE on SQLite, which is already case-insensitive", async () => {
    const { likeInsensitive, jsonArrayContains, isPostgres } = await loadDialect(
      "file:./zavu-inbox.db"
    );

    expect(isPostgres).toBe(false);

    const search = sqlite.sqlToQuery(
      likeInsensitive(sqliteSchema.conversations.lastMessageText, "%ana%")
    );
    expect(search.sql).toContain("like");
    expect(search.sql).not.toContain("ilike");

    const channel = sqlite.sqlToQuery(
      jsonArrayContains(sqliteSchema.conversations.channels, "whatsapp")
    );
    expect(channel.sql).not.toContain("::text");
  });

  it("quotes the needle so one channel cannot match a longer one", async () => {
    const { jsonArrayContains } = await loadDialect("file:./zavu-inbox.db");

    const channel = sqlite.sqlToQuery(
      jsonArrayContains(sqliteSchema.conversations.channels, "whatsapp")
    );

    expect(channel.params).toEqual(['%"whatsapp"%']);
  });

  it("binds the needle as a parameter rather than concatenating it", async () => {
    const { jsonArrayContains } = await loadDialect("file:./zavu-inbox.db");

    const hostile = `x" or 1=1 --`;
    const channel = sqlite.sqlToQuery(
      jsonArrayContains(sqliteSchema.conversations.channels, hostile)
    );

    // The value reaches the driver as a bound parameter; the SQL text is a
    // placeholder and never carries the input.
    expect(channel.params).toEqual([`%"${hostile}"%`]);
    expect(channel.sql).not.toContain("1=1");
    expect(channel.sql).toContain("?");
  });
});
