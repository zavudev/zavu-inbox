/**
 * Types shared by both dialect schemas. Anything declared here must produce the
 * same TypeScript shape whether the row came from Postgres or libSQL, because
 * the rest of the app is written against one set of types.
 */

export type BusinessHours = {
  // 0 = Sunday. Absent day = closed all day.
  [weekday: number]: { open: string; close: string } | undefined;
};

export const USER_ROLES = ["owner", "admin", "member"] as const;
export const INVITE_ROLES = ["admin", "member"] as const;
export const CONVERSATION_STATUSES = ["open", "done", "snoozed"] as const;
export const MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export const SCHEDULED_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;
export const CONVERSATION_EVENT_TYPES = [
  "assigned",
  "unassigned",
  "status_changed",
  "snoozed",
  "inbox_changed",
] as const;
