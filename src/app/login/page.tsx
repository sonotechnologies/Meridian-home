import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { googleEnabled } from "@/lib/auth";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const REASONS: Record<string, string> = {
  save: "Sign in to save homes and find them again later.",
  search: "Sign in to save this search. We’ll email you new matches.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const { next, reason } = await searchParams;
  if (await getUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <AuthShell title="Sign in" lead={(reason && REASONS[reason]) ?? "Welcome back."}>
      <AuthForm mode="login" next={next} googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
