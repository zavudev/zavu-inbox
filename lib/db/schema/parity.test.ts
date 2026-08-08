import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as pg from "./pg";
import * as sqlite from "./sqlite";

/**
 * `schema/index.ts` casts the Postgres tables to the SQLite table types so the
 * app can be written against one set of types. That cast is only honest while
 * the two schemas describe the same rows, so this test is what makes it true
 * rather than hopeful: add a column to one dialect and it goes red here, not in
 * production on whichever backend you were not running.
 */

type SchemaModule = Record<string, unknown>;

function tablesOf(module: SchemaModule): Map<string, Table> {
  const tables = new Map<string, Table>();

  for (const value of Object.values(module)) {
    // `is` is Drizzle's own brand check, and the only reliable way to tell a
    // table from the constants and helpers exported alongside it.
    if (is(value, Table)) {
      tables.set(getTableName(value), value);
    }
  }

  return tables;
}

const pgTables = tablesOf(pg as SchemaModule);
const sqliteTables = tablesOf(sqlite as SchemaModule);

describe("schema parity", () => {
  it("declares the same tables in both dialects", () => {
    expect([...sqliteTables.keys()].sort()).toEqual([...pgTables.keys()].sort());
  });

  it("declares at least the tables the app needs", () => {
    // Guards against both modules being empty, which would make every other
    // assertion here pass vacuously.
    expect(sqliteTables.size).toBeGreaterThanOrEqual(16);
  });

  for (const [tableName, sqliteTable] of sqliteTables) {
    describe(tableName, () => {
      const pgTable = pgTables.get(tableName);

      it("exists in Postgres too", () => {
        expect(pgTable).toBeDefined();
      });

      it("has the same columns", () => {
        if (!pgTable) return;

        const sqliteColumns = Object.keys(getTableColumns(sqliteTable)).sort();
        const pgColumns = Object.keys(getTableColumns(pgTable)).sort();

        expect(sqliteColumns).toEqual(pgColumns);
      });

      it("agrees on database column names, nullability and keys", () => {
        if (!pgTable) return;

        const describeColumns = (table: Table) =>
          Object.entries(getTableColumns(table))
            .map(([property, column]) => ({
              property,
              name: column.name,
              notNull: column.notNull,
              primary: column.primary,
              hasDefault: column.hasDefault,
            }))
            .sort((a, b) => a.property.localeCompare(b.property));

        expect(describeColumns(sqliteTable)).toEqual(describeColumns(pgTable));
      });
    });
  }
});
