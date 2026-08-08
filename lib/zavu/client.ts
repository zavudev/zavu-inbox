import type {
  ZavuAgent,
  ZavuContact,
  ZavuConversation,
  ZavuMessage,
  ZavuMessageAttachment,
  ZavuPage,
  ZavuPhoneNumber,
  ZavuSender,
  ZavuTemplate,
  ZavuVoiceCall,
} from "./types";

const DEFAULT_BASE_URL = "https://api.zavu.dev";

export class ZavuApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ZavuApiError";
  }

  /** The WhatsApp 24h window closed. Send an approved template instead. */
  get isWindowClosed(): boolean {
    return this.code === "whatsapp_window_closed";
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/**
 * Turns a failure into something an operator can act on. "Zavu is unreachable"
 * when the API answered 401 sends people to check their network for an hour;
 * the distinction between a bad key and a dead connection is the whole message.
 */
export function describeZavuError(error: unknown): { title: string; detail: string } {
  if (error instanceof ZavuApiError) {
    if (error.status === 401) {
      return {
        title: "Zavu rejected the API key",
        detail: `${error.message}. Check ZAVU_API_KEY in your environment, then restart.`,
      };
    }
    if (error.status === 403) {
      return {
        title: "Not allowed on this plan",
        detail: error.message,
      };
    }
    if (error.status === 402) {
      return {
        title: "Zavu balance is empty",
        detail: "Top up in the Zavu dashboard to keep sending.",
      };
    }
    if (error.isRateLimited) {
      return {
        title: "Rate limited by Zavu",
        detail: "Too many requests. This clears on its own.",
      };
    }
    return { title: `Zavu returned ${error.status}`, detail: error.message };
  }

  return {
    title: "Could not reach Zavu",
    detail:
      error instanceof Error
        ? error.message
        : "The API did not answer. Check the network and ZAVU_API_URL.",
  };
}

export interface SendMessageParams {
  to: string;
  channel?: string;
  messageType?: string;
  text?: string;
  content?: Record<string, unknown>;
  subject?: string;
  htmlBody?: string;
  replyTo?: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
  /** Sender override. Sent as the Zavu-Sender header, not in the body. */
  senderId?: string;
}

export class ZavuClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    const apiKey = options?.apiKey ?? process.env.ZAVU_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ZAVU_API_KEY is not set. Create a key in the Zavu dashboard and put it in .env."
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options?.baseUrl ?? process.env.ZAVU_API_URL ?? DEFAULT_BASE_URL).replace(
      /\/$/,
      ""
    );
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      query?: Record<string, string | number | undefined | null>;
      body?: unknown;
      senderId?: string;
    }
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (options?.body !== undefined) headers["Content-Type"] = "application/json";
    if (options?.senderId) headers["Zavu-Sender"] = options.senderId;

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    if (response.status === 204) return undefined as T;

    const raw = await response.text();
    const parsed = raw ? safeJsonParse(raw) : null;

    if (!response.ok) {
      const error = (parsed ?? {}) as { code?: string; message?: string; details?: unknown };
      throw new ZavuApiError(
        response.status,
        error.code ?? "unknown_error",
        error.message ?? `Zavu API ${method} ${path} failed with ${response.status}`,
        error.details
      );
    }

    return parsed as T;
  }

  // -------------------------------------------------------------------------
  // Conversations
  // -------------------------------------------------------------------------

  conversations = {
    list: (params?: {
      limit?: number;
      cursor?: string;
      channel?: string;
      senderId?: string;
    }): Promise<ZavuPage<ZavuConversation>> =>
      this.request("GET", "/v1/conversations", { query: params }),

    get: (conversationId: string): Promise<{ conversation: ZavuConversation }> =>
      this.request("GET", `/v1/conversations/${conversationId}`),

    messages: (
      conversationId: string,
      params?: { limit?: number; cursor?: string }
    ): Promise<ZavuPage<ZavuMessage>> =>
      this.request("GET", `/v1/conversations/${conversationId}/messages`, {
        query: params,
      }),

    markRead: (conversationId: string): Promise<{ conversation: ZavuConversation }> =>
      this.request("POST", `/v1/conversations/${conversationId}/read`),

    /** Walks every page. Used by the initial import, not by request handlers. */
    listAll: async (params?: { senderId?: string; pageSize?: number }) => {
      const all: ZavuConversation[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.conversations.list({
          limit: params?.pageSize ?? 100,
          cursor,
          senderId: params?.senderId,
        });
        all.push(...page.items);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      return all;
    },
  };

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  messages = {
    send: async (params: SendMessageParams): Promise<ZavuMessage> => {
      const { senderId, ...body } = params;
      const result = await this.request<{ message: ZavuMessage }>(
        "POST",
        "/v1/messages",
        { body, senderId }
      );
      return result.message;
    },

    get: async (messageId: string): Promise<ZavuMessage> => {
      const result = await this.request<{ message: ZavuMessage }>(
        "GET",
        `/v1/messages/${messageId}`
      );
      return result.message;
    },

    list: (params?: {
      status?: string;
      to?: string;
      channel?: string;
      limit?: number;
      cursor?: string;
    }): Promise<ZavuPage<ZavuMessage>> =>
      this.request("GET", "/v1/messages", { query: params }),

    attachments: (messageId: string): Promise<{ items: ZavuMessageAttachment[] }> =>
      this.request("GET", `/v1/messages/${messageId}/attachments`),

    react: (messageId: string, emoji: string, senderId?: string) =>
      this.request<{ message: ZavuMessage }>(
        "POST",
        `/v1/messages/${messageId}/reactions`,
        { body: { emoji }, senderId }
      ),

    /**
     * Marks an inbound WhatsApp message read and shows a typing indicator for
     * up to 25 seconds. Best effort: a failure here must never block a reply.
     */
    typing: (messageId: string, senderId?: string) =>
      this.request<{ success: boolean }>("POST", `/v1/messages/${messageId}/typing`, {
        senderId,
      }),
  };

  // -------------------------------------------------------------------------
  // Contacts
  // -------------------------------------------------------------------------

  contacts = {
    list: (params?: {
      phoneNumber?: string;
      limit?: number;
      cursor?: string;
    }): Promise<ZavuPage<ZavuContact>> =>
      this.request("GET", "/v1/contacts", { query: params }),

    get: (contactId: string): Promise<ZavuContact> =>
      this.request("GET", `/v1/contacts/${contactId}`),

    getByPhone: (phoneNumber: string): Promise<ZavuContact> =>
      this.request("GET", `/v1/contacts/phone/${encodeURIComponent(phoneNumber)}`),

    create: (body: {
      displayName?: string;
      channels: Array<{
        channel: string;
        identifier: string;
        countryCode?: string;
        label?: string;
        isPrimary?: boolean;
      }>;
      metadata?: Record<string, string>;
    }): Promise<ZavuContact> => this.request("POST", "/v1/contacts", { body }),

    update: (
      contactId: string,
      body: { defaultChannel?: string | null; metadata?: Record<string, string> }
    ): Promise<ZavuContact> =>
      this.request("PATCH", `/v1/contacts/${contactId}`, { body }),
  };

  // -------------------------------------------------------------------------
  // Senders, numbers, templates
  // -------------------------------------------------------------------------

  senders = {
    list: (params?: { limit?: number; cursor?: string }): Promise<ZavuPage<ZavuSender>> =>
      this.request("GET", "/v1/senders", { query: params }),

    get: (senderId: string): Promise<ZavuSender> =>
      this.request("GET", `/v1/senders/${senderId}`),
  };

  phoneNumbers = {
    list: (params?: {
      status?: string;
      limit?: number;
      cursor?: string;
    }): Promise<ZavuPage<ZavuPhoneNumber>> =>
      this.request("GET", "/v1/phone-numbers", { query: params }),
  };

  templates = {
    list: (params?: {
      limit?: number;
      cursor?: string;
    }): Promise<ZavuPage<ZavuTemplate>> =>
      this.request("GET", "/v1/templates", { query: params }),
  };

  // -------------------------------------------------------------------------
  // Voice and AI agents
  // -------------------------------------------------------------------------

  calls = {
    list: (params?: {
      status?: string;
      direction?: string;
      limit?: number;
      cursor?: string;
    }): Promise<ZavuPage<ZavuVoiceCall>> =>
      this.request("GET", "/v1/calls", { query: params }),

    get: async (callId: string): Promise<ZavuVoiceCall> => {
      const result = await this.request<{ call: ZavuVoiceCall }>(
        "GET",
        `/v1/calls/${callId}`
      );
      return result.call;
    },

    create: async (body: {
      to: string;
      senderId?: string;
      greeting?: string;
      language?: string;
      metadata?: Record<string, string>;
    }): Promise<ZavuVoiceCall> => {
      const result = await this.request<{ call: ZavuVoiceCall }>("POST", "/v1/calls", {
        body,
      });
      return result.call;
    },
  };

  agents = {
    list: (params?: { limit?: number; cursor?: string }): Promise<ZavuPage<ZavuAgent>> =>
      this.request("GET", "/v1/agents", { query: params }),

    get: async (agentId: string): Promise<ZavuAgent> => {
      const result = await this.request<{ agent: ZavuAgent }>(
        "GET",
        `/v1/agents/${agentId}`
      );
      return result.agent;
    },

    update: async (agentId: string, body: Record<string, unknown>): Promise<ZavuAgent> => {
      const result = await this.request<{ agent: ZavuAgent }>(
        "PATCH",
        `/v1/agents/${agentId}`,
        { body }
      );
      return result.agent;
    },

    test: (
      agentId: string,
      body: { message: string; history?: Array<{ role: string; content: string }> }
    ) => this.request<{ success: boolean; text: string | null; warnings: string[] }>(
      "POST",
      `/v1/agents/${agentId}/test`,
      { body }
    ),
  };

  me = (): Promise<{
    project: { id: string; name: string | null; isSubAccount: boolean };
    team: { id: string; name: string | null };
    isTestMode: boolean;
  }> => this.request("GET", "/v1/me");
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { message: raw };
  }
}

let cached: ZavuClient | null = null;

/** Process-wide client. Throws on first use if ZAVU_API_KEY is missing. */
export function zavu(): ZavuClient {
  if (!cached) cached = new ZavuClient();
  return cached;
}
