"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, Input, Textarea } from "@/components/ui/primitives";
import { formatPhone } from "@/lib/utils";
import { updateInbox } from "@/lib/actions/workspace";
import type { BusinessHours } from "@/lib/db/schema";

const WEEKDAYS = [
  { index: 1, label: "Mon" },
  { index: 2, label: "Tue" },
  { index: 3, label: "Wed" },
  { index: 4, label: "Thu" },
  { index: 5, label: "Fri" },
  { index: 6, label: "Sat" },
  { index: 0, label: "Sun" },
];

const DEFAULT_DAY = { open: "09:00", close: "18:00" };

export function InboxSettings({
  inbox,
  editable,
}: {
  inbox: {
    id: string;
    name: string;
    phoneNumber: string | null;
    timezone: string;
    businessHours: BusinessHours | null;
    awayMessage: string | null;
    awayMessageEnabled: boolean;
    channels: string[];
  };
  editable: boolean;
}) {
  const [name, setName] = useState(inbox.name);
  const [timezone, setTimezone] = useState(inbox.timezone);
  const [hours, setHours] = useState<BusinessHours>(inbox.businessHours ?? {});
  const [awayMessage, setAwayMessage] = useState(inbox.awayMessage ?? "");
  const [awayEnabled, setAwayEnabled] = useState(inbox.awayMessageEnabled);
  const [pending, startTransition] = useTransition();

  const toggleDay = (index: number) => {
    setHours((current) => {
      const next = { ...current };
      if (next[index]) delete next[index];
      else next[index] = { ...DEFAULT_DAY };
      return next;
    });
  };

  const setDayTime = (index: number, field: "open" | "close", value: string) => {
    setHours((current) => ({
      ...current,
      [index]: { ...(current[index] ?? DEFAULT_DAY), [field]: value },
    }));
  };

  const save = () => {
    startTransition(async () => {
      const result = await updateInbox(inbox.id, {
        name,
        timezone,
        businessHours: Object.keys(hours).length > 0 ? hours : null,
        awayMessage: awayMessage.trim() || null,
        awayMessageEnabled: awayEnabled,
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Saved");
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 pb-3">
        <p className="flex-1 font-mono text-[11px] text-[var(--color-muted)]">
          {inbox.phoneNumber ? formatPhone(inbox.phoneNumber) : "Inbox"}
        </p>
        {inbox.channels.map((channel) => (
          <Badge key={channel}>{channel}</Badge>
        ))}
      </div>

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[var(--color-muted)]">Name</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!editable}
              className="h-8"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[var(--color-muted)]">Timezone</span>
            <Input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              disabled={!editable}
              placeholder="America/Santiago"
              className="h-8"
            />
          </label>
        </div>

        <div>
          <p className="pb-1.5 text-xs text-[var(--color-muted)]">Business hours</p>

          {Object.keys(hours).length === 0 ? (
            // Without this the form shows seven "Closed" rows and reads as a
            // shop that never opens, while the code treats an empty schedule as
            // always open. Say which one is true.
            <p className="mb-2 rounded-[var(--radius-card)] bg-[var(--color-surface-2)] px-2.5 py-2 text-xs text-[var(--color-muted)]">
              No schedule set, so this inbox counts as open at all times and no
              auto-reply is ever sent. Tick a day to define hours.
            </p>
          ) : null}

          <div className="space-y-1.5">
            {WEEKDAYS.map((day) => {
              const value = hours[day.index];
              return (
                <div key={day.index} className="flex items-center gap-2">
                  <label className="flex w-20 cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={() => toggleDay(day.index)}
                      disabled={!editable}
                      className="cursor-pointer"
                    />
                    {day.label}
                  </label>

                  {value ? (
                    <>
                      <input
                        type="time"
                        value={value.open}
                        onChange={(event) =>
                          setDayTime(day.index, "open", event.target.value)
                        }
                        disabled={!editable}
                        className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-sm"
                      />
                      <span className="text-xs text-[var(--color-muted)]">to</span>
                      <input
                        type="time"
                        value={value.close}
                        onChange={(event) =>
                          setDayTime(day.index, "close", event.target.value)
                        }
                        disabled={!editable}
                        className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-sm"
                      />
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={awayEnabled}
              onChange={(event) => setAwayEnabled(event.target.checked)}
              disabled={!editable}
              className="cursor-pointer"
            />
            Auto-reply outside business hours
          </label>

          {awayEnabled ? (
            <Textarea
              value={awayMessage}
              onChange={(event) => setAwayMessage(event.target.value)}
              disabled={!editable}
              rows={2}
              placeholder="Thanks for writing. We are closed right now and will reply when we open."
            />
          ) : null}

          <p className="text-[11px] text-[var(--color-muted)]">
            The auto-reply is sent by Zavu Inbox on the first inbound message outside
            hours, once per conversation per closed period.
          </p>
        </div>

        {editable ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={pending}>
              Save
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
