import { Mail, MessageCircle, MessageSquare, Phone, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  sms: "SMS",
  sms_oneway: "SMS",
  whatsapp: "WhatsApp",
  whatsapp_alt: "WhatsApp",
  email: "Email",
  telegram: "Telegram",
  instagram: "Instagram",
  messenger: "Messenger",
  voice: "Voice",
};

/**
 * Channel is metadata, not state, so it stays monochrome. Colour in this app is
 * reserved for the single accent and for real state (brand §5.4).
 */
export function ChannelIcon({
  channel,
  withLabel = true,
  className,
}: {
  channel: string;
  withLabel?: boolean;
  className?: string;
}) {
  const Icon = iconFor(channel);
  const label = LABELS[channel] ?? channel;

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[var(--color-muted)]", className)}
      title={label}
    >
      <Icon className="size-3" />
      {withLabel ? <span className="label-mono">{label}</span> : null}
    </span>
  );
}

function iconFor(channel: string) {
  switch (channel) {
    case "email":
      return Mail;
    case "whatsapp":
    case "whatsapp_alt":
      return MessageCircle;
    case "telegram":
      return Send;
    case "voice":
      return Phone;
    default:
      return MessageSquare;
  }
}
