import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { googleEnabled } from "@/lib/auth";
import { getUser } from "@/server/session";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <AuthShell title="Create an account" lead="Save homes, save searches and get an email when something new matches.">
      <AuthForm mode="signup" next={next} googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
