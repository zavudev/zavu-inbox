"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { Clock, Send, StickyNote, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, Textarea } from "@/components/ui/primitives";
import { addComment, sendReply, showTyping } from "@/lib/actions/conversations";
import { cancelScheduledMessage, scheduleMessage } from "@/lib/actions/workspace";
import { ChannelIcon } from "./channel-icon";
import type { ScheduledMessage, Snippet } from "@/lib/db/schema";

type Mode = "reply" | "note";

export function Composer({
  conversationId,
  channels,
  defaultChannel,
  snippets,
  members,
  lastInboundMessageId,
  senderId,
  scheduled,
}: {
  conversationId: string;
  channels: string[];
  defaultChannel: string;
  snippets: Snippet[];
  members: Array<{ id: string; name: string }>;
  lastInboundMessageId?: string;
  senderId: string | null;
  scheduled: ScheduledMessage[];
}) {
  const [mode, setMode] = useState<Mode>("reply");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState(defaultChannel);
  const [subject, setSubject] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingSent = useRef(false);

  // Reset per thread: a draft for one contact must never leak into another.
  useEffect(() => {
    setText("");
    setSubject("");
    setMode("reply");
    setChannel(defaultChannel);
    typingSent.current = false;
  }, [conversationId, defaultChannel]);

  const sendableChannels = channels.length > 0 ? channels : [defaultChannel];
  const isEmail = channel === "email";

  const handleChange = (value: string) => {
    setText(value);

    // Show the contact a typing indicator once we actually start drafting a
    // reply. WhatsApp only, best effort, and never on an internal note.
    if (
      mode === "reply" &&
      !typingSent.current &&
      value.length > 2 &&
      lastInboundMessageId &&
      channel.startsWith("whatsapp")
    ) {
      typingSent.current = true;
      void showTyping(lastInboundMessageId, senderId ?? undefined);
    }
  };

  const expandSnippet = (value: string): string => {
    // "/shortcut " expands as you type, which is how a saved reply is supposed
    // to feel: no picker, no clicking.
    const match = value.match(/(?:^|\s)\/([a-z0-9-]+)\s$/i);
    if (!match) return value;

    const snippet = snippets.find((s) => s.shortcut === match[1].toLowerCase());
    if (!snippet) return value;

    return value.replace(/(?:^|\s)\/[a-z0-9-]+\s$/i, (prefix) =>
      (prefix.startsWith(" ") ? " " : "") + snippet.body + " "
    );
  };

  const submit = () => {
    const body = text.trim();
    if (!body || pending) return;

    startTransition(async () => {
      if (mode === "note") {
        const result = await addComment(conversationId, body);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setText("");
        return;
      }

      if (showSchedule && scheduleAt) {
        const result = await scheduleMessage({
          conversationId,
          text: body,
          sendAt: scheduleAt,
          channel,
          subject: isEmail ? subject : undefined,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Scheduled for ${format(new Date(scheduleAt), "d MMM, HH:mm")}`);
        setText("");
        setScheduleAt("");
        setShowSchedule(false);
        return;
      }

      const result = await sendReply({
        conversationId,
        text: body,
        channel,
        subject: isEmail ? subject : undefined,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setText("");
      typingSent.current = false;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line: the convention every inbox uses.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      {scheduled.length > 0 ? (
        <div className="border-b border-[var(--color-border)] px-4 py-2">
          {scheduled.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-xs">
              <Clock className="size-3 text-[var(--color-muted)]" />
              <span className="text-[var(--color-muted)]">
                Scheduled for {format(item.sendAt, "d MMM, HH:mm")}:
              </span>
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await cancelScheduledMessage(item.id);
                    toast.success("Cancelled");
                  })
                }
                className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-error)]"
                aria-label="Cancel scheduled message"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1 px-3 pt-2">
        <TabButton active={mode === "reply"} onClick={() => setMode("reply")}>
          Reply
        </TabButton>
        <TabButton active={mode === "note"} onClick={() => setMode("note")}>
          <StickyNote className="size-3.5" />
          Internal note
        </TabButton>

        {mode === "reply" && sendableChannels.length > 1 ? (
          <div className="ml-auto flex items-center gap-1">
            {sendableChannels.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setChannel(option)}
                className={cn(
                  "cursor-pointer rounded px-1.5 py-1 transition-colors",
                  channel === option
                    ? "bg-[var(--color-surface-2)]"
                    : "opacity-60 hover:opacity-100"
                )}
              >
                <ChannelIcon channel={option} withLabel={false} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {mode === "reply" && isEmail ? (
        <div className="px-3 pt-2">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            className="w-full border-b border-[var(--color-border)] bg-transparent pb-1.5 text-sm outline-none placeholder:text-[var(--color-muted)]"
          />
        </div>
      ) : null}

      <div className="p-3">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => handleChange(expandSnippet(event.target.value))}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder={
            mode === "note"
              ? "Write a note for your team. Use @name to notify someone."
              : snippets.length > 0
                ? "Write a reply. Type /shortcut to insert a snippet."
                : "Write a reply."
          }
          className={cn(
            mode === "note" &&
              "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5"
          )}
        />

        {showSchedule ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setShowSchedule(false);
                setScheduleAt("");
              }}
              className="cursor-pointer text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="mt-2 flex items-center gap-2">
          {mode === "note" && members.length > 1 ? (
            <p className="text-[11px] text-[var(--color-muted)]">
              Notes stay in Zavu Inbox. They are never sent to the contact.
            </p>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            {mode === "reply" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSchedule((open) => !open)}
                title="Schedule for later"
              >
                <Clock />
              </Button>
            ) : null}
            <Button
              variant={mode === "note" ? "default" : "signal"}
              size="sm"
              onClick={submit}
              disabled={pending || !text.trim() || (showSchedule && !scheduleAt)}
            >
              {mode === "note" ? (
                "Add note"
              ) : showSchedule ? (
                "Schedule"
              ) : (
                <>
                  <Send />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
        active
          ? "bg-[var(--color-surface-2)] font-medium"
          : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      )}
    >
      {children}
    </button>
  );
}
