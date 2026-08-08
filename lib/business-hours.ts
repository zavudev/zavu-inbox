import type { BusinessHours } from "@/lib/db/schema";

/**
 * Business hours are evaluated in the inbox's own timezone, never the server's.
 * A team in Santiago must not go "closed" because the container runs in UTC.
 */

type LocalParts = { weekday: number; minutes: number };

function localParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = weekdays.indexOf(weekdayName);

  return { weekday: weekday === -1 ? 0 : weekday, minutes: hour * 60 + minute };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

/** No configured hours means always open: an empty schedule is not a closed shop. */
export function isWithinBusinessHours(
  hours: BusinessHours | null | undefined,
  timeZone: string,
  at: Date = new Date()
): boolean {
  if (!hours || Object.keys(hours).length === 0) return true;

  let zone = timeZone;
  const { weekday, minutes } = (() => {
    try {
      return localParts(at, zone);
    } catch {
      // An operator can type anything into the timezone field. Falling back to
      // UTC is wrong by hours; claiming "open" is wrong by one auto-reply. Take
      // the smaller error and keep the inbox answering.
      zone = "UTC";
      return localParts(at, "UTC");
    }
  })();

  const today = hours[weekday];
  if (!today) return false;

  return minutes >= toMinutes(today.open) && minutes < toMinutes(today.close);
}

/**
 * When the current closed stretch began, used to send at most one auto-reply
 * per closed period rather than one per message.
 *
 * Returns null when the inbox is open, or when no open day exists in the last
 * week (a schedule that never opens has no meaningful period boundary).
 */
export function closedPeriodStart(
  hours: BusinessHours | null | undefined,
  timeZone: string,
  at: Date = new Date()
): Date | null {
  if (isWithinBusinessHours(hours, timeZone, at)) return null;
  if (!hours || Object.keys(hours).length === 0) return null;

  // Walk back a minute at a time would be correct and slow. Instead step back
  // day by day and take that day's close time, which is where the current
  // closed stretch started.
  for (let daysAgo = 0; daysAgo < 8; daysAgo++) {
    const candidate = new Date(at.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    let parts: LocalParts;
    try {
      parts = localParts(candidate, timeZone);
    } catch {
      parts = localParts(candidate, "UTC");
    }

    const day = hours[parts.weekday];
    if (!day) continue;

    const closeMinutes = toMinutes(day.close);
    // On the starting day, the close must already have happened.
    if (daysAgo === 0 && parts.minutes < closeMinutes) continue;

    const start = new Date(candidate);
    start.setUTCMinutes(start.getUTCMinutes() - (parts.minutes - closeMinutes));
    return start;
  }

  return null;
}
