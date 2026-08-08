import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { rethrowIfMissingSchema } from "@/lib/db/errors";
import { sessions, users, type User } from "@/lib/db/schema";

const COOKIE_NAME = "zavu_inbox_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  // Opportunistic cleanup. A self-hosted instance has no cron by default, so
  // expired rows have to be swept by whatever traffic there is.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(COOKIE_NAME);
}

/** The signed-in user, or null. Does not redirect. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let rows;
  try {
    rows = await db
      .select({ user: users, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, hashToken(token)))
      .limit(1);
  } catch (error) {
    rethrowIfMissingSchema(error);
  }

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.user.deactivatedAt) return null;

  return row.user;
}

/** The signed-in user, or a redirect to /login. Use in pages and actions. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role === "member") {
    throw new Error("This action requires an admin.");
  }
  return user;
}

/** True when nobody has signed up yet: the first run owns the workspace. */
export async function isFirstRun(): Promise<boolean> {
  try {
    const rows = await db.select({ id: users.id }).from(users).limit(1);
    return rows.length === 0;
  } catch (error) {
    // This is the first query the app runs, so it is where a database with no
    // tables surfaces. Say so instead of leaking "no such table: users".
    rethrowIfMissingSchema(error);
  }
}
