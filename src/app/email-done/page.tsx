import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Done", robots: { index: false } };

const COPY: Record<string, Record<string, [string, string]>> = {
  renew: {
    ok: ["Renewed for 30 days", "Thanks. Your listing is back on the map and buyers see it as confirmed available today."],
    closed: ["This listing is closed", "It was closed or taken down, so it can’t be renewed. Post it again from your dashboard if it’s available."],
    invalid: ["That link has expired", "Renew the listing from your dashboard instead. It takes one tap."],
  },
  unsubscribe: {
    ok: ["You won’t get these emails any more", "We’ve turned off alerts for that saved search. Your other saved searches are unchanged."],
    invalid: ["That link didn’t work", "Manage your alerts from your saved searches instead."],
  },
};

export default async function EmailDone({ searchParams }: { searchParams: Promise<{ what?: string; state?: string }> }) {
  const { what = "renew", state = "invalid" } = await searchParams;
  const [title, body] = COPY[what]?.[state] ?? COPY.renew!.invalid!;
  return (
    <AuthShell title={title} lead={body}>
      <ButtonLink href={what === "renew" ? "/dashboard/listings" : "/searches"} variant="secondary">
        {what === "renew" ? "Go to your listings" : "Your saved searches"}
      </ButtonLink>
    </AuthShell>
  );
}
