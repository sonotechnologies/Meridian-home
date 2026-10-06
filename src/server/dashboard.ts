import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, listingImages, listingRentTerms, listings } from "@/db/schema";

export type AgentListingRow = {
  id: string;
  slug: string;
  title: string;
  type: "rent" | "sale" | "shortlet";
  price: number;
  status: "draft" | "pending" | "active" | "expired" | "closed" | "rejected";
  display: "draft" | "pending" | "active" | "expiring" | "expired" | "closed" | "rejected";
  hiddenByReports: boolean;
  rejectionReason: string | null;
  cover: string | null;
  views: number;
  leads: number;
  daysLeft: number | null;
  draftStep: number;
  totalUpfront: number | null;
};

const WEEK = 7 * 86_400_000;

export async function agentListings(agentId: string): Promise<AgentListingRow[]> {
  const rows = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      title: listings.title,
      type: listings.type,
      price: listings.price,
      status: listings.status,
      hiddenByReports: listings.hiddenByReports,
      rejectionReason: listings.rejectionReason,
      views: listings.viewCount,
      expiresAt: listings.expiresAt,
      draftStep: listings.draftStep,
      totalUpfront: listingRentTerms.totalUpfront,
      cover: sql<string | null>`(select ${listingImages.url} from ${listingImages} where ${listingImages.listingId} = ${listings.id} order by ${listingImages.position} limit 1)`,
      leads: sql<number>`(select count(*)::int from ${leads} where ${leads.listingId} = ${listings.id})`,
    })
    .from(listings)
    .leftJoin(listingRentTerms, eq(listingRentTerms.listingId, listings.id))
    .where(eq(listings.agentId, agentId))
    .orderBy(
      sql`case ${listings.status} when 'draft' then 0 when 'rejected' then 1 when 'pending' then 2 when 'active' then 3 else 4 end`,
      desc(listings.updatedAt),
    );
  const now = Date.now();
  return rows.map((r) => {
    const expired = r.status === "active" && r.expiresAt && r.expiresAt.getTime() < now;
    const daysLeft = r.status === "active" && r.expiresAt ? Math.max(0, Math.ceil((r.expiresAt.getTime() - now) / 86_400_000)) : null;
    const display = expired
      ? "expired"
      : r.status === "active" && r.expiresAt && r.expiresAt.getTime() - now < WEEK
        ? "expiring"
        : r.status;
    return { ...r, status: expired ? "expired" : r.status, display, daysLeft, totalUpfront: r.totalUpfront ?? null };
  });
}

export async function agentStats(agentId: string, rows?: AgentListingRow[]) {
  const list = rows ?? (await agentListings(agentId));
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(eq(leads.agentId, agentId), gte(leads.createdAt, new Date(Date.now() - WEEK))));
  return {
    active: list.filter((l) => l.display === "active" || l.display === "expiring").length,
    pending: list.filter((l) => l.status === "pending").length,
    expiring: list.filter((l) => l.display === "expiring").length,
    leadsThisWeek: n,
  };
}
