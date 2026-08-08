"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AtSign,
  CheckSquare,
  Inbox as InboxIcon,
  Phone,
  Settings,
  Users,
} from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";
import { Avatar, Badge } from "@/components/ui/primitives";
import { signOut } from "@/lib/actions/auth";

type SidebarInbox = {
  id: string;
  name: string;
  phoneNumber: string | null;
  channels: string[];
};

export function AppSidebar({
  user,
  inboxes,
  counts,
  mentionCount,
}: {
  user: { id: string; name: string; role: string; avatarColor: string };
  inboxes: SidebarInbox[];
  counts: { open: number; mine: number; unassigned: number };
  mentionCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") ?? "open";
  const activeInbox = searchParams.get("inbox");

  const inInbox = pathname.startsWith("/inbox");

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="text-sm font-medium tracking-tight">Zavu Inbox</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 pb-4 scrollbar-thin">
        <section className="space-y-0.5">
          <NavLink
            href="/inbox?view=open"
            icon={<InboxIcon />}
            label="Open"
            count={counts.open}
            active={inInbox && !activeInbox && view === "open"}
          />
          <NavLink
            href="/inbox?view=mine"
            icon={<AtSign />}
            label="Assigned to me"
            count={counts.mine}
            active={inInbox && !activeInbox && view === "mine"}
          />
          <NavLink
            href="/inbox?view=unassigned"
            icon={<Users />}
            label="Unassigned"
            count={counts.unassigned}
            active={inInbox && !activeInbox && view === "unassigned"}
          />
          <NavLink
            href="/inbox?view=done"
            icon={<CheckSquare />}
            label="Done"
            active={inInbox && !activeInbox && view === "done"}
          />
        </section>

        {inboxes.length > 0 ? (
          <section className="space-y-0.5">
            <p className="label-mono px-3 pb-1">Inboxes</p>
            {inboxes.map((inbox) => (
              <NavLink
                key={inbox.id}
                href={`/inbox?inbox=${inbox.id}`}
                icon={<Phone />}
                label={inbox.name}
                sublabel={inbox.phoneNumber ? formatPhone(inbox.phoneNumber) : undefined}
                active={activeInbox === inbox.id}
              />
            ))}
          </section>
        ) : null}

        <section className="space-y-0.5">
          <p className="label-mono px-3 pb-1">Workspace</p>
          <NavLink
            href="/contacts"
            icon={<Users />}
            label="Contacts"
            active={pathname.startsWith("/contacts")}
          />
          <NavLink
            href="/calls"
            icon={<Phone />}
            label="Calls"
            active={pathname.startsWith("/calls")}
          />
          <NavLink
            href="/tasks"
            icon={<CheckSquare />}
            label="Tasks"
            count={mentionCount > 0 ? mentionCount : undefined}
            active={pathname.startsWith("/tasks")}
          />
          <NavLink
            href="/settings"
            icon={<Settings />}
            label="Settings"
            active={pathname.startsWith("/settings")}
          />
        </section>
      </nav>

      <div className="border-t border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2">
          <Avatar name={user.name} color={user.avatarColor} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="label-mono">{user.role}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  label,
  sublabel,
  count,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-fg)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
      )}
    >
      <span className="[&_svg]:size-4 [&_svg]:shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">
        {label}
        {sublabel ? (
          <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted)]">
            {sublabel}
          </span>
        ) : null}
      </span>
      {count ? <Badge>{count}</Badge> : null}
    </Link>
  );
}
