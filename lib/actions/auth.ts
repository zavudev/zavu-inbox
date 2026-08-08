"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invites, users, workspace } from "@/lib/db/schema";
import { createSession, destroySession, isFirstRun, requireAdmin } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { newId, pickAvatarColor } from "@/lib/utils";
import { syncAllConversations, syncInboxes } from "@/lib/sync";

export type FormState = { error?: string; ok?: boolean; inviteUrl?: string };

const MIN_PASSWORD_LENGTH = 10;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];

  // Same message and roughly the same work whether or not the account exists,
  // so this endpoint cannot be used to enumerate members.
  const stored =
    user?.passwordHash ??
    "0000000000000000000000000000000000000000000000000000000000000000:0000";
  const valid = await verifyPassword(password, stored);

  if (!user || !valid || user.deactivatedAt) {
    return { error: "Wrong email or password." };
  }

  await createSession(user.id);
  redirect("/inbox");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * First run: creates the owner and imports what already exists in Zavu, so the
 * inbox has history on the very first screen instead of looking broken.
 */
export async function completeSetup(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await isFirstRun())) {
    return { error: "This workspace is already set up. Sign in instead." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const workspaceName = String(formData.get("workspaceName") ?? "").trim() || "Zavu Inbox";

  if (!name || !email) return { error: "Name and email are required." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.` };
  }

  const userId = newId("usr");
  await db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash: await hashPassword(password),
    role: "owner",
    avatarColor: pickAvatarColor(email),
  });

  await db
    .insert(workspace)
    .values({ id: "workspace", name: workspaceName, setupCompletedAt: new Date() })
    .onConflictDoUpdate({
      target: workspace.id,
      set: { name: workspaceName, setupCompletedAt: new Date() },
    });

  // The import can be slow on a busy project, but a first run that lands on an
  // empty inbox reads as a broken install.
  try {
    await syncInboxes();
    const imported = await syncAllConversations();
    await db
      .update(workspace)
      .set({ lastSyncAt: new Date() })
      .where(eq(workspace.id, "workspace"));
    console.log(`[setup] imported ${imported} conversations from Zavu.`);
  } catch (error) {
    // A bad API key should not cost the operator their account: they can fix
    // the key and re-run the import from Settings.
    console.error("[setup] initial import failed", error);
  }

  await createSession(userId);
  redirect("/inbox");
}

export async function createInvite(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const admin = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member") === "admin" ? "admin" : "member";
  if (!email) return { error: "Email is required." };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return { error: "That person is already a member." };

  const token = randomBytes(24).toString("hex");
  await db.insert(invites).values({
    id: newId("inv"),
    email,
    role,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    invitedBy: admin.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // No mail server is assumed in a self-hosted install, so the link is handed
  // back to the admin to deliver however they already talk to their team.
  const baseUrl = process.env.APP_URL ?? "http://localhost:4100";
  return { ok: true, inviteUrl: `${baseUrl}/join/${token}` };
}

export async function acceptInvite(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Name is required." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.` };
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const rows = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.tokenHash, tokenHash),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, new Date())
      )
    )
    .limit(1);

  const invite = rows[0];
  if (!invite) return { error: "That invitation is invalid or has expired." };

  const userId = newId("usr");
  await db.insert(users).values({
    id: userId,
    email: invite.email,
    name,
    passwordHash: await hashPassword(password),
    role: invite.role,
    avatarColor: pickAvatarColor(invite.email),
  });

  await db.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));

  await createSession(userId);
  redirect("/inbox");
}
