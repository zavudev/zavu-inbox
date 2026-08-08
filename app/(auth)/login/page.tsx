import { redirect } from "next/navigation";
import { getCurrentUser, isFirstRun } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

// Reads the database to decide between setup and sign-in, so there is nothing
// to prerender.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isFirstRun()) redirect("/setup");
  if (await getCurrentUser()) redirect("/inbox");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="label-mono">Zavu Inbox</p>
          <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
