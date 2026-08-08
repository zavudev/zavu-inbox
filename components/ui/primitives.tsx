"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, initials } from "@/lib/utils";

/**
 * The full primitive set for Zavu Inbox, in one file. Brand rules baked in:
 * every button is `cursor-pointer`, actionable buttons are solid rather than
 * outline (outline reads as disabled), and at most one accent button lives in
 * a composition.
 */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // High contrast: black on light, white on dark.
        default:
          "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90",
        // The single conversion action per composition.
        signal: "bg-[var(--color-signal)] text-white hover:opacity-90",
        // Tertiary and icon affordances only.
        ghost: "hover:bg-[var(--color-surface-2)] text-[var(--color-fg)]",
        outline:
          "border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]",
        danger: "bg-[var(--color-error)] text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-base outline-none transition-colors placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-signal)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base outline-none transition-colors placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-signal)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-[var(--color-fg)]", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className
      )}
      {...props}
    />
  );
}

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
        signal: "bg-[var(--color-signal)]/10 text-[var(--color-signal)]",
        success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
        warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
        error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const AVATAR_TONES: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  lime: "bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-300",
};

export function Avatar({
  name,
  color = "violet",
  size = 28,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        AVATAR_TONES[color] ?? AVATAR_TONES.violet,
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      title={name}
    >
      {initials(name) || "?"}
    </span>
  );
}

/** Skeleton, never a spinner: the repo standard is a shape, not a loader. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-[var(--color-surface-2)]", className)} />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? <div className="text-[var(--color-muted)]">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Copyable ID. Every screen backed by the API shows the ID it is looking at,
 * so a developer can jump straight to `curl`.
 */
export function CopyableId({ id, className }: { id: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title={copied ? "Copied" : "Copy"}
      // Deliberately not `.label-mono`: that class uppercases, and an ID or a
      // URL has to render exactly as it will be pasted. Showing CONV_DEMO_1 for
      // conv_demo_1 is a lie the clipboard then contradicts.
      className={cn(
        "cursor-pointer rounded px-1 py-0.5 font-mono text-[11px] tracking-tight transition-colors",
        copied
          ? "text-[var(--color-success)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]",
        className
      )}
    >
      {copied ? "Copied" : id}
    </button>
  );
}
