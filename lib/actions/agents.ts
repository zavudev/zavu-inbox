"use server";

import { requireUser } from "@/lib/auth/session";
import { zavu } from "@/lib/zavu/client";

export async function testAgent(
  agentId: string,
  message: string
): Promise<{ text: string | null; error?: string; warnings: string[] }> {
  await requireUser();

  try {
    const result = await zavu().agents.test(agentId, { message });
    return {
      text: result.text,
      error: result.success ? undefined : "The agent returned an error.",
      warnings: result.warnings ?? [],
    };
  } catch (error) {
    return {
      text: null,
      error: error instanceof Error ? error.message : "Could not reach Zavu.",
      warnings: [],
    };
  }
}
