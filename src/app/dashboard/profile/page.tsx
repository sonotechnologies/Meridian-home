import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { agentProfiles } from "@/db/schema";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { VerifiedBadge } from "@/components/ui";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireRole("agent", "/dashboard/profile");
  const [p] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, user.id)).limit(1);
  if (!p) notFound();
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">{p.fullName}</h1>
        {p.status === "verified" ? <VerifiedBadge /> : null}
      </div>
      <ProfileForm name={p.fullName} slug={p.slug} initial={{ agencyName: p.agencyName, whatsapp: p.whatsapp, bio: p.bio ?? "", photoUrl: p.photoUrl }} />
    </div>
  );
}
