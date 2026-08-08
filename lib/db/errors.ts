/**
 * Forgetting to run the migrations is the first mistake a self-hoster makes,
 * and the driver's own message ("no such table: sessions") reads like a bug in
 * Zavu Inbox rather than a missing step.
 */

const MISSING_SCHEMA_PATTERNS = [
  /no such table/i, // SQLite / libSQL
  /relation ".*" does not exist/i, // Postgres
  /undefined_table/i, // Postgres error code name
];

export function isMissingSchemaError(error: unknown): boolean {
  const messages: string[] = [];

  let current: unknown = error;
  // Drivers wrap the real cause a level or two down.
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      messages.push(current.message);
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }

  return messages.some((message) =>
    MISSING_SCHEMA_PATTERNS.some((pattern) => pattern.test(message))
  );
}

export class MigrationsNotRunError extends Error {
  constructor() {
    super(
      "The database has no tables yet. Run the migrations before starting Zavu Inbox:\n" +
        "  npm run db:migrate\n" +
        "With Docker this runs on its own; if you see this there, check the `migrate` service logs."
    );
    this.name = "MigrationsNotRunError";
  }
}

/** Rethrows a missing-schema failure as something actionable. */
export function rethrowIfMissingSchema(error: unknown): never {
  if (isMissingSchemaError(error)) {
    const friendly = new MigrationsNotRunError();
    console.error(`\n[zavu-inbox] ${friendly.message}\n`);
    throw friendly;
  }
  throw error;
}
