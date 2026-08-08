/**
 * Types for the slice of the Zavu API that Zavu Inbox uses. Hand written rather
 * than generated: the published SDK lags the spec, and the endpoints an inbox
 * needs most (conversations) are not in it yet.
 *
 * Source of truth: https://api.zavu.dev + apps/docs/openapi.json
 */

export type ZavuChannel =
  | "auto"
  | "sms"
  | "sms_oneway"
  | "whatsapp"
  | "whatsapp_alt"
  | "email"
  | "telegram"
  | "instagram"
  | "messenger"
  | "voice";

export type ZavuMessageStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received"
  | "pending_url_verification";

export type ZavuMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "buttons"
  | "list"
  | "cta_url"
  | "request_contact_info"
  | "location_request"
  | "reaction"
  | "template";

export interface ZavuConversation {
  id: string;
  contactId?: string;
  /** Phone, BSUID, numeric chat ID, or group JID. Do not parse as a phone. */
  contactIdentifier: string;
  email?: string;
  channels: string[];
  lastMessage: {
    id: string;
    text: string;
    channel: string;
    direction: "inbound" | "outbound";
    at: string;
  };
  senderId?: string;
  messageCount: number;
  unreadCount: number;
  whatsapp?: { bsuid?: string; username?: string };
  group?: { id: string; subject?: string; participantCount?: number };
  createdAt: string;
  updatedAt: string;
}

export interface ZavuMessage {
  id: string;
  to: string;
  from?: string;
  senderId?: string;
  channel: ZavuChannel;
  messageType: ZavuMessageType;
  status: ZavuMessageStatus;
  text?: string;
  content?: Record<string, unknown>;
  conversationId?: string;
  providerMessageId?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  cost?: number | null;
  costTotal?: number | null;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export interface ZavuMessageAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId: string | null;
  isInline: boolean;
  downloadUrl: string | null;
  createdAt: string;
}

export interface ZavuContactChannel {
  id: string;
  channel: string;
  identifier: string;
  countryCode?: string;
  label?: string;
  isPrimary: boolean;
  verified: boolean;
  lastInboundAt?: string;
}

export interface ZavuContact {
  id: string;
  displayName?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  countryCode?: string;
  profileName?: string | null;
  availableChannels: string[];
  defaultChannel?: string;
  verified: boolean;
  channels?: ZavuContactChannel[];
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt?: string;
}

export interface ZavuSender {
  id: string;
  name: string;
  phoneNumber: string;
  /** What the sender can actually send right now. Trust this, not phoneNumber. */
  channels?: string[];
  isDefault?: boolean;
  emailAddress?: string;
  emailReceivingEnabled?: boolean;
  whatsapp?: { phoneNumberId?: string; displayPhoneNumber?: string };
  createdAt?: string;
}

export interface ZavuPhoneNumber {
  id: string;
  phoneNumber: string;
  name?: string;
  capabilities: string[];
  status: "active" | "suspended" | "pending";
  senderId?: string;
  createdAt: string;
}

export interface ZavuTemplate {
  id: string;
  name: string;
  language: string;
  body: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  status?: "draft" | "pending" | "approved" | "rejected";
  variables?: string[];
  headerType?: string;
  headerContent?: string;
  footer?: string;
}

export interface ZavuVoiceCallTurn {
  seq: number;
  role: "user" | "assistant" | "tool";
  text: string;
  startedAt?: string | null;
  endedAt?: string | null;
}

export interface ZavuVoiceCall {
  id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status: string;
  endReason?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  turnCount?: number | null;
  transcript?: ZavuVoiceCallTurn[];
  cost?: number | null;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface ZavuAgent {
  id: string;
  senderId: string;
  name: string;
  enabled: boolean;
  provider: string;
  model: string;
  systemPrompt: string;
  contextWindowMessages?: number;
  triggerOnChannels?: string[];
  triggerOnMessageTypes?: string[];
  senderIds?: string[];
  voice?: {
    enabled: boolean;
    greeting?: string;
    language?: string;
    ttsVoiceId?: string;
    maxCallDurationMinutes?: number;
    transferPhoneNumber?: string;
  };
  stats?: { totalInvocations: number; totalTokensUsed: number; totalCost: number };
}

export interface ZavuPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** Webhook envelope. `data` shape depends on `type`. */
export interface ZavuWebhookPayload {
  id: string;
  type: string;
  timestamp: number;
  senderId?: string;
  projectId?: string;
  data: Record<string, unknown>;
}

export interface ZavuInboundMessageData {
  messageId: string;
  to: string;
  from?: string;
  channel: ZavuChannel;
  status: ZavuMessageStatus;
  messageType?: ZavuMessageType;
  /** Null while the thread row is still being created. Recover via the message. */
  conversationId?: string | null;
  text?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  providerTimestamp?: number | null;
}
