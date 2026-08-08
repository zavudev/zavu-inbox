import { format } from "date-fns";
import { AlertCircle, Check, CheckCheck, Clock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import type { ZavuMessage } from "@/lib/zavu/types";

/**
 * One message. Inbound sits left on a surface, outbound sits right in the
 * accent. Delivery state is a tick, never a colour: colour is reserved for
 * actual failure.
 */
export function MessageBubble({ message }: { message: ZavuMessage }) {
  const inbound = message.status === "received";
  const failed = message.status === "failed";
  const content = message.content ?? {};

  return (
    <div className={cn("my-1.5 flex", inbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[70%] min-w-0", inbound ? "" : "items-end")}>
        {message.messageType === "template" ? (
          <p className="mb-1 text-right">
            <span className="label-mono">Template</span>
          </p>
        ) : null}

        <div
          className={cn(
            "rounded-[var(--radius-card)] px-3 py-2",
            inbound
              ? "bg-[var(--color-surface-2)]"
              : failed
                ? "border border-[var(--color-error)]/40 bg-[var(--color-error)]/5"
                : "bg-[var(--color-signal)] text-white"
          )}
        >
          <MediaPreview content={content} messageType={message.messageType} />

          {message.text ? (
            <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
          ) : null}

          {renderInteractive(content)}
        </div>

        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]",
            inbound ? "" : "justify-end"
          )}
        >
          <ChannelIcon channel={message.channel} withLabel={false} />
          <time>{format(new Date(message.createdAt), "HH:mm")}</time>
          {inbound ? null : <StatusTick status={message.status} />}
        </div>

        {failed && message.errorMessage ? (
          <p className="mt-0.5 text-right text-[11px] text-[var(--color-error)]">
            {message.errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StatusTick({ status }: { status: string }) {
  switch (status) {
    case "queued":
    case "sending":
      return <Clock className="size-3" aria-label="Queued" />;
    case "sent":
      return <Check className="size-3" aria-label="Sent" />;
    case "delivered":
      return <CheckCheck className="size-3" aria-label="Delivered" />;
    case "read":
      return (
        <CheckCheck className="size-3 text-[var(--color-signal)]" aria-label="Read" />
      );
    case "failed":
      return (
        <AlertCircle className="size-3 text-[var(--color-error)]" aria-label="Failed" />
      );
    default:
      return null;
  }
}

function MediaPreview({
  content,
  messageType,
}: {
  content: Record<string, unknown>;
  messageType: string;
}) {
  const mediaUrl = typeof content.mediaUrl === "string" ? content.mediaUrl : null;

  if (messageType === "image" && mediaUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- media is remote and
    // arbitrary; next/image would need every provider host allow-listed.
    return (
      <img
        src={mediaUrl}
        alt=""
        className="mb-1.5 max-h-64 w-auto rounded"
        loading="lazy"
      />
    );
  }

  if (messageType === "audio" && mediaUrl) {
    return <audio controls src={mediaUrl} className="mb-1.5 w-56" />;
  }

  if (messageType === "video" && mediaUrl) {
    return <video controls src={mediaUrl} className="mb-1.5 max-h-64 rounded" />;
  }

  if (messageType === "document" && mediaUrl) {
    const filename =
      typeof content.filename === "string" ? content.filename : "Attachment";
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-1.5 flex items-center gap-1.5 text-sm underline"
      >
        <Paperclip className="size-3.5" />
        {filename}
      </a>
    );
  }

  if (messageType === "location") {
    const lat = content.latitude;
    const lng = content.longitude;
    if (typeof lat === "number" && typeof lng === "number") {
      return (
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="mb-1.5 block text-sm underline"
        >
          {typeof content.locationName === "string"
            ? content.locationName
            : `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        </a>
      );
    }
  }

  return null;
}

function renderInteractive(content: Record<string, unknown>) {
  const buttons = Array.isArray(content.buttons) ? content.buttons : null;
  if (!buttons || buttons.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {buttons.map((button, index) => {
        const title =
          typeof button === "object" && button !== null && "title" in button
            ? String((button as { title: unknown }).title)
            : "Button";
        return (
          <span
            key={index}
            className="rounded border border-current/30 px-2 py-0.5 text-[11px]"
          >
            {title}
          </span>
        );
      })}
    </div>
  );
}
