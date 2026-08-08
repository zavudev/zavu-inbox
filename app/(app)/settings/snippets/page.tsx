import { requireUser } from "@/lib/auth/session";
import { listSnippetsFor } from "@/lib/actions/workspace";
import { SnippetManager } from "@/components/settings/snippet-manager";

export default async function SnippetsPage() {
  const user = await requireUser();
  const snippets = await listSnippetsFor(user.id);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-6">
        <h1 className="text-sm font-medium">Snippets</h1>
        <p className="ml-3 text-xs text-[var(--color-muted)]">
          Type /shortcut in the composer to insert one
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        <SnippetManager snippets={snippets} currentUserId={user.id} />
      </div>
    </div>
  );
}
