import { randomBytes } from "node:crypto";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sortable, URL-safe id: time prefix keeps rows roughly in insertion order. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `${prefix}_${time}${random}`;
}

const AVATAR_COLORS = [
  "violet",
  "blue",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "fuchsia",
  "lime",
] as const;

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * A conversation is keyed on a phone, a BSUID, a numeric chat ID, or a group
 * JID. Render whichever it is without pretending it is a phone number.
 */
export function displayIdentifier(identifier: string, name?: string | null): string {
  if (name) return name;
  if (identifier.endsWith("@g.us")) return "Group chat";
  if (identifier.includes("@")) return identifier;
  if (/^\+?\d{7,15}$/.test(identifier)) return formatPhone(identifier);
  // BSUID ("US.1349...") or a platform chat ID: showing the raw string is more
  // honest than formatting it into something it is not.
  return identifier;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}
