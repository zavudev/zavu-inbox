"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Avatar, Button, Card, Textarea } from "@/components/ui/primitives";
import { addContactNote } from "@/lib/actions/workspace";

export function ContactNotes({
  contactId,
  notes,
}: {
  contactId: string;
  notes: Array<{
    id: string;
    body: string;
    createdAt: Date;
    authorName: string | null;
    authorColor: string | null;
  }>;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const result = await addContactNote(contactId, trimmed);
      if (!result.ok) toast.error(result.error);
      else setBody("");
    });
  };

  return (
    <Card className="p-4">
      <p className="label-mono pb-3">Notes</p>

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        placeholder="What should the team know about this contact?"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          Add note
        </Button>
      </div>

      {notes.length > 0 ? (
        <ul className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-2">
              <Avatar
                name={note.authorName ?? "?"}
                color={note.authorColor ?? "violet"}
                size={24}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">
                    {note.authorName ?? "Someone"}
                  </span>
                  <time className="text-[11px] text-[var(--color-muted)]">
                    {format(note.createdAt, "d MMM, HH:mm")}
                  </time>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{note.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
