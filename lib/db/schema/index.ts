import { DIALECT } from "../dialect";
import * as pg from "./pg";
import * as sqlite from "./sqlite";

/**
 * The active schema. libSQL/SQLite is canonical for types: it is the default
 * backend, and both dialects declare identical row shapes.
 *
 * The Postgres tables are cast to the SQLite table types at this single
 * boundary. That is a real cast, and it is safe only while the two schemas
 * agree, which is exactly what `parity.test.ts` enforces: it compares table
 * names, column names, nullability, primary keys and defaults, and fails if
 * anything diverges. Add a column to one dialect and the test goes red before
 * the cast can lie.
 */
const active = (DIALECT === "postgres" ? pg : sqlite) as unknown as typeof sqlite;

export const users = active.users;
export const sessions = active.sessions;
export const invites = active.invites;
export const inboxes = active.inboxes;
export const inboxMembers = active.inboxMembers;
export const conversations = active.conversations;
export const comments = active.comments;
export const mentions = active.mentions;
export const conversationEvents = active.conversationEvents;
export const snippets = active.snippets;
export const tasks = active.tasks;
export const scheduledMessages = active.scheduledMessages;
export const contactNotes = active.contactNotes;
export const contactProperties = active.contactProperties;
export const webhookEvents = active.webhookEvents;
export const workspace = active.workspace;

export type { BusinessHours } from "./shared";

export type User = typeof sqlite.users.$inferSelect;
export type Inbox = typeof sqlite.inboxes.$inferSelect;
export type Conversation = typeof sqlite.conversations.$inferSelect;
export type Comment = typeof sqlite.comments.$inferSelect;
export type Snippet = typeof sqlite.snippets.$inferSelect;
export type Task = typeof sqlite.tasks.$inferSelect;
export type ScheduledMessage = typeof sqlite.scheduledMessages.$inferSelect;
export type ConversationEvent = typeof sqlite.conversationEvents.$inferSelect;
