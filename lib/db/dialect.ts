import { sql, type SQL } from "drizzle-orm";

export type Dialect = "sqlite" | "postgres";

/**
 * The dialect is read from the shape of DATABASE_URL, so switching backends is
 * one line in .env and no code change.
 *
 *   libsql://<db>.turso.io          Turso (the default, and the cheapest)
 *   file:./zavu-inbox.db               local SQLite file, no server
 *   postgres:// | postgresql://     Postgres
 */
export function detectDialect(url = process.env.DATABASE_URL ?? ""): Dialect {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }
  return "sqlite";
}

export const DIALECT: Dialect = detectDialect();
export const isPostgres = DIALECT === "postgres";

/**
 * Case-insensitive match. Postgres needs ILIKE; SQLite's LIKE is already
 * case-insensitive for ASCII, and has no ILIKE at all.
 */
export function likeInsensitive(column: unknown, pattern: string): SQL {
  return isPostgres
    ? sql`${column} ilike ${pattern}`
    : sql`${column} like ${pattern}`;
}

/**
 * "Does this JSON array column contain this exact string?"
 *
 * Postgres stores it as jsonb and SQLite as text, so neither `@>` nor
 * `json_each` is portable. Matching the quoted needle against the serialized
 * array is, and it is exact: `%"whatsapp"%` does not match `"whatsapp_alt"`,
 * because the closing quote has to be there.
 *
 * The value is interpolated as a bound parameter, never concatenated.
 */
export function jsonArrayContains(column: unknown, value: string): SQL {
  const needle = `%"${value}"%`;
  return isPostgres
    ? sql`${column}::text like ${needle}`
    : sql`${column} like ${needle}`;
}
