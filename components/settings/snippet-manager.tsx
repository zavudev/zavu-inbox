"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, Input, Textarea } from "@/components/ui/primitives";
import { createSnippet, deleteSnippet } from "@/lib/actions/workspace";
import type { Snippet } from "@/lib/db/schema";

export function SnippetManager({
  snippets,
  currentUserId,
}: {
  snippets: Snippet[];
  currentUserId: string;
}) {
  const [shortcut, setShortcut] = useState("");
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(true);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await createSnippet({ shortcut, body, shared });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setShortcut("");
      setBody("");
      toast.success("Snippet saved");
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-4">
        <p className="label-mono pb-3">New snippet</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-muted)]">/</span>
            <Input
              value={shortcut}
              onChange={(event) => setShortcut(event.target.value)}
              placeholder="hours"
              className="h-8"
            />
          </div>

          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="We are open Monday to Friday, 9am to 6pm."
          />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shared}
              onChange={(event) => setShared(event.target.checked)}
              className="cursor-pointer"
            />
            Share with the whole workspace
          </label>

          <div className="flex justify-end">
            <Button onClick={save} disabled={pending || !shortcut.trim() || !body.trim()}>
              Save snippet
            </Button>
          </div>
        </div>
      </Card>

      {snippets.length === 0 ? (
        <EmptyState
          title="No snippets yet"
          description="Save the answers your team types over and over."
        />
      ) : (
        <Card className="divide-y divide-[var(--color-border)]">
          {snippets.map((snippet) => (
            <div key={snippet.id} className="flex items-start gap-3 px-4 py-3">
              <code className="shrink-0 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 font-mono text-xs">
                /{snippet.shortcut}
              </code>
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{snippet.body}</p>
              {snippet.shared ? <span className="label-mono">shared</span> : null}
              {snippet.shared || snippet.createdBy === currentUserId ? (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteSnippet(snippet.id);
                    })
                  }
                  className="cursor-pointer text-[var(--color-muted)] transition-colors hover:text-[var(--color-error)]"
                  aria-label={`Delete /${snippet.shortcut}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
