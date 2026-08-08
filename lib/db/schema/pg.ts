import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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
 * Zavu Inbox stores only what Zavu does not: who works here and what they did to a
 * thread. Messages, contacts, numbers and senders stay in Zavu and are read
 * through the API.
 *
 * The one exception is `conversations`, which mirrors the Zavu thread. An inbox
 * has to sort by last activity while filtering on assignee and status at the
 * same time, and those live on opposite sides of the network. The mirror is a
 * cache: `zavuId` is the source of truth and any row can be rebuilt from
 * `GET /v1/conversations`.
 */

// ---------------------------------------------------------------------------
// People and access
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // scrypt: "<salt>:<derived key>", both hex. Node built-in, no native deps.
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES })
      .notNull()
      .default("member"),
    avatarColor: text("avatar_color").notNull().default("violet"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    // The session token itself, stored hashed so a database dump cannot be
    // replayed as a login.
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const invites = pgTable(
  "invites",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role", { enum: INVITE_ROLES }).notNull().default("member"),
    tokenHash: text("token_hash").notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invites_token_idx").on(t.tokenHash)]
);

// ---------------------------------------------------------------------------
// Inboxes: a Zavu sender, plus who staffs it
// ---------------------------------------------------------------------------

export const inboxes = pgTable(
  "inboxes",
  {
    id: text("id").primaryKey(),
    zavuSenderId: text("zavu_sender_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("violet"),
    // Cached from GET /v1/senders so the list renders without a round trip.
    phoneNumber: text("phone_number"),
    emailAddress: text("email_address"),
    channels: jsonb("channels").$type<string[]>().notNull().default([]),
    // IANA zone. Business hours are evaluated against it, never against the
    // server's clock.
    timezone: text("timezone").notNull().default("UTC"),
    businessHours: jsonb("business_hours").$type<BusinessHours | null>(),
    awayMessage: text("away_message"),
    awayMessageEnabled: boolean("away_message_enabled").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("inboxes_sender_idx").on(t.zavuSenderId)]
);

export const inboxMembers = pgTable(
  "inbox_members",
  {
    inboxId: text("inbox_id")
      .notNull()
      .references(() => inboxes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.inboxId, t.userId] }),
    index("inbox_members_user_idx").on(t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Conversations: Zavu's thread plus this workspace's state
// ---------------------------------------------------------------------------

export const conversations = pgTable(
  "conversations",
  {
    // Zavu conversation ID. Stable across channels and across WhatsApp
    // identity re-keying, which is why it is the primary key here too.
    zavuId: text("zavu_id").primaryKey(),
    inboxId: text("inbox_id").references(() => inboxes.id, { onDelete: "set null" }),
    zavuSenderId: text("zavu_sender_id"),

    // Mirror of the Zavu thread.
    contactIdentifier: text("contact_identifier").notNull(),
    email: text("email"),
    zavuContactId: text("zavu_contact_id"),
    contactName: text("contact_name"),
    channels: jsonb("channels").$type<string[]>().notNull().default([]),
    lastMessageText: text("last_message_text").notNull().default(""),
    lastMessageChannel: text("last_message_channel"),
    lastMessageDirection: text("last_message_direction", { enum: MESSAGE_DIRECTIONS }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull(),
    messageCount: integer("message_count").notNull().default(0),
    unreadCount: integer("unread_count").notNull().default(0),
    isGroup: boolean("is_group").notNull().default(false),
    groupSubject: text("group_subject"),
    whatsappUsername: text("whatsapp_username"),

    // Workspace state. None of this exists in Zavu.
    status: text("status", { enum: CONVERSATION_STATUSES })
      .notNull()
      .default("open"),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    /** Last out-of-hours auto-reply, so one is sent per closed period, not per message. */
    lastAutoReplyAt: timestamp("last_auto_reply_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The inbox list sorts by activity and filters on status/assignee, so both
    // filtered views get an index rather than a sequential scan.
    index("conversations_status_activity_idx").on(t.status, t.lastActivityAt),
    index("conversations_assignee_activity_idx").on(t.assigneeId, t.lastActivityAt),
    index("conversations_inbox_activity_idx").on(t.inboxId, t.lastActivityAt),
    index("conversations_contact_idx").on(t.zavuContactId),
  ]
);

/** Internal notes. Never delivered to the contact. */
export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.zavuId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_conversation_idx").on(t.conversationId, t.createdAt)]
);

export const mentions = pgTable(
  "mentions",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.userId] }),
    index("mentions_user_unread_idx").on(t.userId, t.readAt),
  ]
);

/** Assignment and status changes, rendered inline in the thread. */
export const conversationEvents = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_events_conversation_idx").on(t.conversationId, t.createdAt)]
);

// ---------------------------------------------------------------------------
// Productivity
// ---------------------------------------------------------------------------

export const snippets = pgTable(
  "snippets",
  {
    id: text("id").primaryKey(),
    // Typed as /shortcut in the composer.
    shortcut: text("shortcut").notNull(),
    body: text("body").notNull(),
    // Private snippets belong to their author; shared ones to the workspace.
    shared: boolean("shared").notNull().default(true),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("snippets_shortcut_idx").on(t.shortcut)]
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    conversationId: text("conversation_id").references(() => conversations.zavuId, {
      onDelete: "cascade",
    }),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_assignee_idx").on(t.assigneeId, t.completedAt),
    index("tasks_conversation_idx").on(t.conversationId),
  ]
);

/**
 * A message queued for later. The row is the source of truth until it is sent;
 * `zavuMessageId` is filled in once Zavu accepts it, which is also what makes
 * the send idempotent if the worker retries.
 */
export const scheduledMessages = pgTable(
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
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: SCHEDULED_STATUSES })
      .notNull()
      .default("pending"),
    zavuMessageId: text("zavu_message_id"),
    error: text("error"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scheduled_messages_due_idx").on(t.status, t.sendAt)]
);

// ---------------------------------------------------------------------------
// Contact enrichment. The contact itself lives in Zavu; this is what the team
// writes about them.
// ---------------------------------------------------------------------------

export const contactNotes = pgTable(
  "contact_notes",
  {
    id: text("id").primaryKey(),
    zavuContactId: text("zavu_contact_id").notNull(),
    body: text("body").notNull(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_notes_contact_idx").on(t.zavuContactId, t.createdAt)]
);

export const contactProperties = pgTable(
  "contact_properties",
  {
    zavuContactId: text("zavu_contact_id").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.zavuContactId, t.key] })]
);

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

/**
 * Delivered webhook IDs. Zavu retries on failure, so the receiver has to be
 * idempotent: the insert is the lock.
 */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single-row workspace config. Secrets stay in the environment. */
export const workspace = pgTable("workspace", {
  id: text("id").primaryKey().default("workspace"),
  name: text("name").notNull().default("Zavu Inbox"),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

