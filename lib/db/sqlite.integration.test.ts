import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migrations against a real database and exercises the queries
 * that are not portable between dialects. libSQL needs no server, so this is a
 * genuine end-to-end check rather than a mock.
 *
 * The Postgres path cannot be covered here without a server; `parity.test.ts`
 * is what keeps the two schemas honest in the meantime.
 */

const directory = mkdtempSync(join(tmpdir(), "zavu-inbox-test-"));
const databaseFile = join(directory, "test.db");

// Must be set before anything imports lib/db, which reads it at module load.
process.env.DATABASE_URL = `file:${databaseFile}`;

type Modules = {
  db: typeof import("./index").db;
  schema: typeof import("./schema");
  dialect: typeof import("./dialect");
  drizzle: typeof import("drizzle-orm");
};

let m: Modules;

beforeAll(async () => {
  const { runMigrations } = await import("./migrate");
  await runMigrations();

  m = {
    db: (await import("./index")).db,
    schema: await import("./schema"),
    dialect: await import("./dialect"),
    drizzle: await import("drizzle-orm"),
  };
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("libSQL backend", () => {
  it("detects the dialect from the URL", () => {
    expect(m.dialect.DIALECT).toBe("sqlite");
    expect(m.dialect.detectDialect("postgres://x")).toBe("postgres");
    expect(m.dialect.detectDialect("postgresql://x")).toBe("postgres");
    expect(m.dialect.detectDialect("libsql://x.turso.io")).toBe("sqlite");
    expect(m.dialect.detectDialect("file:./zavu-inbox.db")).toBe("sqlite");
  });

  it("round-trips a row with dates, booleans and a JSON array", async () => {
    const { db, schema } = m;
    const lastMessageAt = new Date("2026-08-05T12:00:00.000Z");

    await db.insert(schema.users).values({
      id: "usr_1",
      email: "ana@example.com",
      name: "Ana Torres",
      passwordHash: "salt:key",
      role: "owner",
    });

    await db.insert(schema.inboxes).values({
      id: "ibx_1",
      zavuSenderId: "sender_1",
      name: "Support",
      channels: ["sms", "whatsapp"],
      awayMessageEnabled: true,
    });

    await db.insert(schema.conversations).values({
      zavuId: "conv_1",
      inboxId: "ibx_1",
      zavuSenderId: "sender_1",
      contactIdentifier: "+56912345678",
      channels: ["whatsapp"],
      lastMessageText: "Hola, necesito ayuda",
      lastMessageChannel: "whatsapp",
      lastMessageDirection: "inbound",
      lastMessageAt,
      lastActivityAt: lastMessageAt,
    });

    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(m.drizzle.eq(schema.conversations.zavuId, "conv_1"));

    // Dates survive as Dates, not as integers.
    expect(conversation.lastMessageAt).toBeInstanceOf(Date);
    expect(conversation.lastMessageAt.toISOString()).toBe(lastMessageAt.toISOString());
    // JSON arrays survive as arrays, not as strings.
    expect(conversation.channels).toEqual(["whatsapp"]);
    expect(conversation.isGroup).toBe(false);
    expect(conversation.status).toBe("open");

    const [inbox] = await db.select().from(schema.inboxes);
    expect(inbox.awayMessageEnabled).toBe(true);
    expect(inbox.channels).toEqual(["sms", "whatsapp"]);
  });

  it("filters by channel without matching a longer channel name", async () => {
    const { db, schema, dialect, drizzle } = m;

    await db.insert(schema.conversations).values({
      zavuId: "conv_alt",
      contactIdentifier: "+56999999999",
      channels: ["whatsapp_alt"],
      lastMessageText: "desde el bridge",
      lastMessageAt: new Date(),
      lastActivityAt: new Date(),
    });

    const whatsapp = await db
      .select({ id: schema.conversations.zavuId })
      .from(schema.conversations)
      .where(dialect.jsonArrayContains(schema.conversations.channels, "whatsapp"));

    // "whatsapp" must not match "whatsapp_alt": the closing quote is the guard.
    expect(whatsapp.map((row) => row.id)).toEqual(["conv_1"]);

    const alt = await db
      .select({ id: schema.conversations.zavuId })
      .from(schema.conversations)
      .where(dialect.jsonArrayContains(schema.conversations.channels, "whatsapp_alt"));

    expect(alt.map((row) => row.id)).toEqual(["conv_alt"]);

    // And it composes with other conditions the way the inbox uses it.
    const combined = await db
      .select({ id: schema.conversations.zavuId })
      .from(schema.conversations)
      .where(
        drizzle.and(
          drizzle.eq(schema.conversations.status, "open"),
          dialect.jsonArrayContains(schema.conversations.channels, "whatsapp")
        )
      );

    expect(combined).toHaveLength(1);
  });

  it("searches case-insensitively", async () => {
    const { db, schema, dialect } = m;

    const found = await db
      .select({ id: schema.conversations.zavuId })
      .from(schema.conversations)
      .where(dialect.likeInsensitive(schema.conversations.lastMessageText, "%HOLA%"));

    expect(found.map((row) => row.id)).toEqual(["conv_1"]);
  });

  it("upserts without clobbering workspace state", async () => {
    const { db, schema, drizzle } = m;

    await db
      .update(schema.conversations)
      .set({ status: "done", assigneeId: "usr_1" })
      .where(drizzle.eq(schema.conversations.zavuId, "conv_1"));

    // The same shape `sync.ts` uses: mirrored columns only in the update set.
    await db
      .insert(schema.conversations)
      .values({
        zavuId: "conv_1",
        contactIdentifier: "+56912345678",
        channels: ["whatsapp", "sms"],
        lastMessageText: "un mensaje nuevo",
        lastMessageAt: new Date(),
        lastActivityAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.conversations.zavuId,
        set: {
          channels: ["whatsapp", "sms"],
          lastMessageText: "un mensaje nuevo",
        },
      });

    const [conversation] = await db
      .select()
      .from(schema.conversations)
      .where(drizzle.eq(schema.conversations.zavuId, "conv_1"));

    expect(conversation.lastMessageText).toBe("un mensaje nuevo");
    expect(conversation.channels).toEqual(["whatsapp", "sms"]);
    // The point of the whole exercise: a sync must not unassign or reopen.
    expect(conversation.status).toBe("done");
    expect(conversation.assigneeId).toBe("usr_1");
  });

  it("enforces the idempotency key the webhook receiver relies on", async () => {
    const { db, schema } = m;

    const first = await db
      .insert(schema.webhookEvents)
      .values({ id: "evt_1", type: "message.inbound" })
      .onConflictDoNothing()
      .returning({ id: schema.webhookEvents.id });

    const duplicate = await db
      .insert(schema.webhookEvents)
      .values({ id: "evt_1", type: "message.inbound" })
      .onConflictDoNothing()
      .returning({ id: schema.webhookEvents.id });

    expect(first).toHaveLength(1);
    expect(duplicate).toHaveLength(0);
  });

  it("cascades deletes from a conversation to its notes", async () => {
    const { db, schema, drizzle } = m;

    await db.insert(schema.comments).values({
      id: "cmt_1",
      conversationId: "conv_1",
      userId: "usr_1",
      body: "Cliente VIP",
    });

    await db
      .delete(schema.conversations)
      .where(drizzle.eq(schema.conversations.zavuId, "conv_1"));

    const remaining = await db.select().from(schema.comments);
    expect(remaining).toHaveLength(0);
  });
});
