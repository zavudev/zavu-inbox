"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/primitives";
import { resyncFromZavu } from "@/lib/actions/workspace";

export function ResyncButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await resyncFromZavu();
          if (result.ok) toast.success("Synced from Zavu");
          else toast.error(result.error);
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Syncing" : "Re-sync"}
    </Button>
  );
}
