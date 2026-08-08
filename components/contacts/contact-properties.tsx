"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input } from "@/components/ui/primitives";
import { setContactProperty } from "@/lib/actions/workspace";

/**
 * Custom fields live in Zavu Inbox, not Zavu: they are workspace vocabulary
 * ("plan", "account manager"), not messaging data.
 */
export function ContactProperties({
  contactId,
  properties,
}: {
  contactId: string;
  properties: Array<{ key: string; value: string }>;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!key.trim() || !value.trim()) return;

    startTransition(async () => {
      const result = await setContactProperty(contactId, key, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setKey("");
      setValue("");
    });
  };

  const remove = (propertyKey: string) => {
    startTransition(async () => {
      await setContactProperty(contactId, propertyKey, "");
    });
  };

  return (
    <Card className="p-4">
      <p className="label-mono pb-3">Custom properties</p>

      {properties.length > 0 ? (
        <dl className="mb-3 space-y-1.5">
          {properties.map((property) => (
            <div key={property.key} className="flex items-start gap-2 text-xs">
              <dt className="w-24 shrink-0 text-[var(--color-muted)]">{property.key}</dt>
              <dd className="min-w-0 flex-1 break-words">{property.value}</dd>
              <button
                type="button"
                onClick={() => remove(property.key)}
                className="cursor-pointer text-[var(--color-muted)] transition-colors hover:text-[var(--color-error)]"
                aria-label={`Remove ${property.key}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="space-y-1.5">
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Property"
          className="h-8 text-sm"
        />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          placeholder="Value"
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={save}
          disabled={pending || !key.trim() || !value.trim()}
        >
          Save
        </Button>
      </div>
    </Card>
  );
}
