CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"zavu_contact_id" text NOT NULL,
	"body" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_properties" (
	"zavu_contact_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_properties_zavu_contact_id_key_pk" PRIMARY KEY("zavu_contact_id","key")
);
--> statement-breakpoint
CREATE TABLE "conversation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_id" text,
	"target_user_id" text,
	"value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"zavu_id" text PRIMARY KEY NOT NULL,
	"inbox_id" text,
	"zavu_sender_id" text,
	"contact_identifier" text NOT NULL,
	"email" text,
	"zavu_contact_id" text,
	"contact_name" text,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_message_text" text DEFAULT '' NOT NULL,
	"last_message_channel" text,
	"last_message_direction" text,
	"last_message_at" timestamp with time zone NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"is_group" boolean DEFAULT false NOT NULL,
	"group_subject" text,
	"whatsapp_username" text,
	"status" text DEFAULT 'open' NOT NULL,
	"assignee_id" text,
	"snoozed_until" timestamp with time zone,
	"last_auto_reply_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_members" (
	"inbox_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_members_inbox_id_user_id_pk" PRIMARY KEY("inbox_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"zavu_sender_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'violet' NOT NULL,
	"phone_number" text,
	"email_address" text,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"business_hours" jsonb,
	"away_message" text,
	"away_message_enabled" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "mentions_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"zavu_sender_id" text,
	"to" text NOT NULL,
	"channel" text NOT NULL,
	"text" text NOT NULL,
	"subject" text,
	"send_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"zavu_message_id" text,
	"error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"shortcut" text NOT NULL,
	"body" text NOT NULL,
	"shared" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"conversation_id" text,
	"assignee_id" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"avatar_color" text DEFAULT 'violet' NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY DEFAULT 'workspace' NOT NULL,
	"name" text DEFAULT 'Zavu Inbox' NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_conversation_id_conversations_zavu_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("zavu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversation_id_conversations_zavu_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("zavu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_members" ADD CONSTRAINT "inbox_members_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_members" ADD CONSTRAINT "inbox_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversation_id_conversations_zavu_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("zavu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_conversation_id_conversations_zavu_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("zavu_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_conversation_idx" ON "comments" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_notes_contact_idx" ON "contact_notes" USING btree ("zavu_contact_id","created_at");--> statement-breakpoint
CREATE INDEX "conversation_events_conversation_idx" ON "conversation_events" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "conversations_status_activity_idx" ON "conversations" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE INDEX "conversations_assignee_activity_idx" ON "conversations" USING btree ("assignee_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "conversations_inbox_activity_idx" ON "conversations" USING btree ("inbox_id","last_activity_at");--> statement-breakpoint
CREATE INDEX "conversations_contact_idx" ON "conversations" USING btree ("zavu_contact_id");--> statement-breakpoint
CREATE INDEX "inbox_members_user_idx" ON "inbox_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inboxes_sender_idx" ON "inboxes" USING btree ("zavu_sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_idx" ON "invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mentions_user_unread_idx" ON "mentions" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "scheduled_messages_due_idx" ON "scheduled_messages" USING btree ("status","send_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "snippets_shortcut_idx" ON "snippets" USING btree ("shortcut");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id","completed_at");--> statement-breakpoint
CREATE INDEX "tasks_conversation_idx" ON "tasks" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");