CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`zavu_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comments_conversation_idx` ON `comments` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contact_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`zavu_contact_id` text NOT NULL,
	`body` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contact_notes_contact_idx` ON `contact_notes` (`zavu_contact_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `contact_properties` (
	`zavu_contact_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`zavu_contact_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `conversation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`type` text NOT NULL,
	`actor_id` text,
	`target_user_id` text,
	`value` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`zavu_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conversation_events_conversation_idx` ON `conversation_events` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`zavu_id` text PRIMARY KEY NOT NULL,
	`inbox_id` text,
	`zavu_sender_id` text,
	`contact_identifier` text NOT NULL,
	`email` text,
	`zavu_contact_id` text,
	`contact_name` text,
	`channels` text NOT NULL,
	`last_message_text` text DEFAULT '' NOT NULL,
	`last_message_channel` text,
	`last_message_direction` text,
	`last_message_at` integer NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`is_group` integer DEFAULT false NOT NULL,
	`group_subject` text,
	`whatsapp_username` text,
	`status` text DEFAULT 'open' NOT NULL,
	`assignee_id` text,
	`snoozed_until` integer,
	`last_auto_reply_at` integer,
	`last_activity_at` integer NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`inbox_id`) REFERENCES `inboxes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `conversations_status_activity_idx` ON `conversations` (`status`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `conversations_assignee_activity_idx` ON `conversations` (`assignee_id`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `conversations_inbox_activity_idx` ON `conversations` (`inbox_id`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `conversations_contact_idx` ON `conversations` (`zavu_contact_id`);--> statement-breakpoint
CREATE TABLE `inbox_members` (
	`inbox_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`inbox_id`, `user_id`),
	FOREIGN KEY (`inbox_id`) REFERENCES `inboxes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inbox_members_user_idx` ON `inbox_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `inboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`zavu_sender_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'violet' NOT NULL,
	`phone_number` text,
	`email_address` text,
	`channels` text NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`business_hours` text,
	`away_message` text,
	`away_message_enabled` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inboxes_sender_idx` ON `inboxes` (`zavu_sender_id`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`token_hash` text NOT NULL,
	`invited_by` text,
	`accepted_at` integer,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_idx` ON `invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `mentions` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mentions_user_unread_idx` ON `mentions` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `scheduled_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`zavu_sender_id` text,
	`to` text NOT NULL,
	`channel` text NOT NULL,
	`text` text NOT NULL,
	`subject` text,
	`send_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`zavu_message_id` text,
	`error` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`zavu_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scheduled_messages_due_idx` ON `scheduled_messages` (`status`,`send_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `snippets` (
	`id` text PRIMARY KEY NOT NULL,
	`shortcut` text NOT NULL,
	`body` text NOT NULL,
	`shared` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `snippets_shortcut_idx` ON `snippets` (`shortcut`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`conversation_id` text,
	`assignee_id` text,
	`due_at` integer,
	`completed_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`zavu_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_assignee_idx` ON `tasks` (`assignee_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `tasks_conversation_idx` ON `tasks` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`avatar_color` text DEFAULT 'violet' NOT NULL,
	`deactivated_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY DEFAULT 'workspace' NOT NULL,
	`name` text DEFAULT 'Zavu Inbox' NOT NULL,
	`setup_completed_at` integer,
	`last_sync_at` integer
);
