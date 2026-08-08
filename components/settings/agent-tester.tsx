"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Input } from "@/components/ui/primitives";
import { testAgent } from "@/lib/actions/agents";

/**
 * Dry run: nothing is delivered and nothing is charged. Warnings from the API
 * are surfaced verbatim, because a passing dry run is not proof the agent works
 * live (the text path never calls tools, for one).
 */
export function AgentTester({ agentId }: { agentId: string }) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{
    text: string | null;
    error?: string;
    warnings: string[];
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    startTransition(async () => {
      const response = await testAgent(agentId, trimmed);
      setResult(response);
    });
  };

  return (
    <div className="space-y-2">
      <p className="label-mono">Try it</p>

      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              run();
            }
          }}
          placeholder="Where is my order?"
          className="h-8"
        />
        <Button size="sm" onClick={run} disabled={pending || !message.trim()}>
          {pending ? "Running" : "Run"}
        </Button>
      </div>

      {result ? (
        <div className="space-y-2">
          {result.error ? (
            <p className="text-sm text-[var(--color-error)]">{result.error}</p>
          ) : (
            <p className="whitespace-pre-wrap rounded-[var(--radius-card)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
              {result.text}
            </p>
          )}

          {result.warnings.length > 0 ? (
            <ul className="space-y-1">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-1.5 text-[11px] text-[var(--color-warning)]"
                >
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
