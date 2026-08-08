import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  CONVERSATION_EVENT_TYPES,
  CONVERSATION_STATUSES,
  INVITE_ROLES,
  MESSAGE_DIRECTIONS,
  SCHEDULED_STATUSES,
  USER_ROLES,
  type BusinessHours,
} from "./shared";

/**
 * The libSQL/SQLite half of the schema. It is the default: Turso costs less
 * than a managed Postgres, and a local file needs no server at all.
 *
 * This must stay row-for-row identical to `pg.ts`. The translations are fixed:
 *
 *   timestamp with time zone  ->  integer({ mode: "timestamp_ms" })
 *   boolean                   ->  integer({ mode: "boolean" })
 *   jsonb                     ->  text({ mode: "json" })
 *   defaultNow()              ->  $defaultFn(() => new Date())
 *
 * Millisecond timestamps rather than seconds, because the inbox sorts on
 * `lastMessageAt` and two messages in the same second must not tie.
 *
 * `schema/parity.test.ts` fails the build if the two drift apart.
 */

const now = () => new Date();

// ---------------------------------------------------------------------------
// People and access
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("member"),
    avatarColor: text("avatar_color").notNull().default("violet"),
    deactivatedAt: integer("deactivated_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role", { enum: INVITE_ROLES }).notNull().default("member"),
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [uniqueIndex("invites_token_idx").on(t.tokenHash)]
);

// ---------------------------------------------------------------------------
// Inboxes
// ---------------------------------------------------------------------------

export const inboxes = sqliteTable(
  "inboxes",
  {
    id: text("id").primaryKey(),
    zavuSenderId: text("zavu_sender_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("violet"),
    phoneNumber: text("phone_number"),
    emailAddress: text("email_address"),
    channels: text("channels", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    timezone: text("timezone").notNull().default("UTC"),
    businessHours: text("business_hours", { mode: "json" }).$type<BusinessHours | null>(),
    awayMessage: text("away_message"),
    awayMessageEnabled: integer("away_message_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [uniqueIndex("inboxes_sender_idx").on(t.zavuSenderId)]
);

export const inboxMembers = sqliteTable(
  "inbox_members",
  {
    inboxId: text("inbox_id")
      .notNull()
      .references(() => inboxes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [
    primaryKey({ columns: [t.inboxId, t.userId] }),
    index("inbox_members_user_idx").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export const conversations = sqliteTable(
  "conversations",
  {
    zavuId: text("zavu_id").primaryKey(),
    inboxId: text("inbox_id").references(() => inboxes.id, { onDelete: "set null" }),
    zavuSenderId: text("zavu_sender_id"),

    contactIdentifier: text("contact_identifier").notNull(),
    email: text("email"),
    zavuContactId: text("zavu_contact_id"),
    contactName: text("contact_name"),
    channels: text("channels", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    lastMessageText: text("last_message_text").notNull().default(""),
    lastMessageChannel: text("last_message_channel"),
    lastMessageDirection: text("last_message_direction", { enum: MESSAGE_DIRECTIONS }),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }).notNull(),
    messageCount: integer("message_count").notNull().default(0),
    unreadCount: integer("unread_count").notNull().default(0),
    isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
    groupSubject: text("group_subject"),
    whatsappUsername: text("whatsapp_username"),

    status: text("status", { enum: CONVERSATION_STATUSES }).notNull().default("open"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    snoozedUntil: integer("snoozed_until", { mode: "timestamp_ms" }),
    lastAutoReplyAt: integer("last_auto_reply_at", { mode: "timestamp_ms" }),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).notNull(),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull().$defaultFn(now),
  },
  (t) => [
    index("conversations_status_activity_idx").on(t.status, t.lastActivityAt),
    index("conversations_assignee_activity_idx").on(t.assigneeId, t.lastActivityAt),
    index("conversations_inbox_activity_idx").on(t.inboxId, t.lastActivityAt),
    index("conversations_contact_idx").on(t.zavuContactId),
  ]
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.zavuId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [index("comments_conversation_idx").on(t.conversationId, t.createdAt)]
);

export const mentions = sqliteTable(
  "mentions",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.userId] }),
    index("mentions_user_unread_idx").on(t.userId, t.readAt),
  ]
);

export const conversationEvents = sqliteTable(
  "conversation_events",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.zavuId, { onDelete: "cascade" }),
    type: text("type", { enum: CONVERSATION_EVENT_TYPES }).notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    targetUserId: text("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    value: text("value"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [index("conversation_events_conversation_idx").on(t.conversationId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Productivity
// ---------------------------------------------------------------------------

export const snippets = sqliteTable(
  "snippets",
  {
    id: text("id").primaryKey(),
    shortcut: text("shortcut").notNull(),
    body: text("body").notNull(),
    shared: integer("shared", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [index("snippets_shortcut_idx").on(t.shortcut)]
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    conversationId: text("conversation_id").references(() => conversations.zavuId, {
      onDelete: "cascade",
    }),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [
    index("tasks_assignee_idx").on(t.assigneeId, t.completedAt),
    index("tasks_conversation_idx").on(t.conversationId),
  ]
);

export const scheduledMessages = sqliteTable(
  "scheduled_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.zavuId, { onDelete: "cascade" }),
    zavuSenderId: text("zavu_sender_id"),
    to: text("to").notNull(),
    channel: text("channel").notNull(),
    text: text("text").notNull(),
    subject: text("subject"),
    sendAt: integer("send_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: SCHEDULED_STATUSES }).notNull().default("pending"),
    zavuMessageId: text("zavu_message_id"),
    error: text("error"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [index("scheduled_messages_due_idx").on(t.status, t.sendAt)]
);

// ---------------------------------------------------------------------------
// Contact enrichment
// ---------------------------------------------------------------------------

export const contactNotes = sqliteTable(
  "contact_notes",
  {
    id: text("id").primaryKey(),
    zavuContactId: text("zavu_contact_id").notNull(),
    body: text("body").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [index("contact_notes_contact_idx").on(t.zavuContactId, t.createdAt)]
);

export const contactProperties = sqliteTable(
  "contact_properties",
  {
    zavuContactId: text("zavu_contact_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(now),
  },
  (t) => [primaryKey({ columns: [t.zavuContactId, t.key] })]
);

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(now),
});

export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey().default("workspace"),
  name: text("name").notNull().default("Zavu Inbox"),
  setupCompletedAt: integer("setup_completed_at", { mode: "timestamp_ms" }),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
});
