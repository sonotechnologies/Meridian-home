import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { leads, listings } from "@/db/schema";
import { LeadTracker } from "@/components/dashboard/lead-tracker";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Leads", robots: { index: false } };

export default async function LeadsPage() {
  const user = await requireRole("agent", "/dashboard/leads");
  const rows = await db
    .select({
      id: leads.id,
      status: leads.status,
      channel: leads.channel,
      name: leads.name,
      phone: leads.phone,
      message: leads.message,
      createdAt: leads.createdAt,
      listingTitle: listings.title,
      listingSlug: listings.slug,
    })
    .from(leads)
    .innerJoin(listings, eq(listings.id, leads.listingId))
    .where(eq(leads.agentId, user.id))
    .orderBy(desc(leads.createdAt))
    .limit(500);
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">Leads</h1>
        <p className="m-0 text-[15px] text-muted">Every WhatsApp tap and call-back request on your listings. We email you each call-back as it comes in.</p>
      </div>
      <LeadTracker rows={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} />
    </div>
  );
}
