import { redirect } from "next/navigation";
import { getCurrentUser, isFirstRun } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (await isFirstRun()) redirect("/setup");
  redirect((await getCurrentUser()) ? "/inbox" : "/login");
}
