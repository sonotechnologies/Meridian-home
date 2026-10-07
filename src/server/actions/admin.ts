"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { agentProfiles, areas, listings, reports, session, users } from "@/db/schema";
import { AgentDecisionEmail, ListingDecisionEmail } from "@/emails/templates";
import { slugify } from "@/lib/format";
import { expiryFrom } from "@/lib/listing-rules";
import { publicEnv } from "@/lib/public-env";
import { sendEmail } from "@/server/email";
import { assertRole } from "@/server/session";

type R = { ok: true } | { ok: false; error: string };

const reason = z.string().trim().min(10, "Write a reason of at least 10 characters. The agent will read it.").max(600);

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

/* ---------- Agents ---------- */

export async function approveAgent(userId: string): Promise<R> {
  await assertRole("admin");
  const [p] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId)).limit(1);
  if (!p || p.status !== "pending") return { ok: false, error: "This application is no longer pending." };
  await db.transaction(async (tx) => {
    await tx.update(agentProfiles).set({ status: "verified", decidedAt: new Date(), rejectionReason: null }).where(eq(agentProfiles.userId, userId));
    await tx.update(users).set({ role: "agent" }).where(eq(users.id, userId));
    // Role is cached in the session cookie; end sessions so it's picked up on next sign-in.
    await tx.delete(session).where(eq(session.userId, userId));
  });
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (u) {
    await sendEmail({
      to: u.email,
      subject: "You’re verified on Meridian",
      react: AgentDecisionEmail({ name: p.fullName, approved: true, dashboardUrl: `${publicEnv.siteUrl}/dashboard/listings/new` }),
      text: `Hello ${p.fullName.split(" ")[0]}, your agent account is approved. Sign in and post your first listing: ${publicEnv.siteUrl}/dashboard/listings/new`,
    }).catch((e) => console.error(e));
  }
  revalidateAdmin();
  return { ok: true };
}

/** Reject requires a reason, which is emailed to the applicant. */
export async function rejectAgent(userId: string, why: string): Promise<R> {
  await assertRole("admin");
  const r = reason.safeParse(why);
  if (!r.success) return { ok: false, error: r.error.issues[0]!.message };
  const [p] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, userId)).limit(1);
  if (!p || p.status !== "pending") return { ok: false, error: "This application is no longer pending." };
  await db.update(agentProfiles).set({ status: "rejected", rejectionReason: r.data, decidedAt: new Date() }).where(eq(agentProfiles.userId, userId));
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (u) {
    await sendEmail({
      to: u.email,
      subject: "About your Meridian agent application",
      react: AgentDecisionEmail({ name: p.fullName, approved: false, reason: r.data, dashboardUrl: `${publicEnv.siteUrl}/for-agents` }),
      text: `Hello ${p.fullName.split(" ")[0]}, we couldn't approve your agent application: ${r.data}\nYou can apply again at ${publicEnv.siteUrl}/for-agents`,
    }).catch((e) => console.error(e));
  }
  revalidateAdmin();
  return { ok: true };
}

/** Suspends the account and takes its live listings off the map. */
export async function suspendAgent(userId: string, why: string): Promise<R> {
  const admin = await assertRole("admin");
  if (admin.id === userId) return { ok: false, error: "You can’t suspend yourself." };
  const r = reason.safeParse(why);
  if (!r.success) return { ok: false, error: r.error.issues[0]!.message };
  await db.transaction(async (tx) => {
    await tx.update(users).set({ suspended: true }).where(eq(users.id, userId));
    await tx.update(agentProfiles).set({ status: "suspended", rejectionReason: r.data, decidedAt: new Date() }).where(eq(agentProfiles.userId, userId));
    await tx
      .update(listings)
      .set({ status: "rejected", rejectionReason: `Agent suspended: ${r.data}` })
      .where(and(eq(listings.agentId, userId), sql`${listings.status} in ('active', 'pending')`));
    await tx.delete(session).where(eq(session.userId, userId));
  });
  revalidateAdmin();
  return { ok: true };
}

/* ---------- Listings ---------- */

async function listingWithAgent(id: string) {
  const [row] = await db
    .select({ l: listings, email: users.email, name: users.name })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.agentId))
    .where(eq(listings.id, id))
    .limit(1);
  return row;
}

/** Approve: live for 30 days; counts towards the agent's three approvals before auto-publish. */
export async function approveListing(id: string): Promise<R> {
  await assertRole("admin");
  const row = await listingWithAgent(id);
  if (!row || row.l.status !== "pending") return { ok: false, error: "This listing is no longer waiting for review." };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(listings).set({ status: "active", publishedAt: now, expiresAt: expiryFrom(now), rejectionReason: null }).where(eq(listings.id, id));
    await tx
      .update(agentProfiles)
      .set({ approvedListingCount: sql`${agentProfiles.approvedListingCount} + 1` })
      .where(eq(agentProfiles.userId, row.l.agentId));
  });
  await sendEmail({
    to: row.email,
    subject: `${row.l.title} is live on Meridian`,
    react: ListingDecisionEmail({ name: row.name, listingTitle: row.l.title, approved: true, url: `${publicEnv.siteUrl}/listing/${row.l.slug}` }),
    text: `"${row.l.title}" is now on the map: ${publicEnv.siteUrl}/listing/${row.l.slug}`,
  }).catch((e) => console.error(e));
  revalidateAdmin();
  revalidatePath(`/listing/${row.l.slug}`);
  return { ok: true };
}

export async function rejectListing(id: string, why: string): Promise<R> {
  await assertRole("admin");
  const r = reason.safeParse(why);
  if (!r.success) return { ok: false, error: r.error.issues[0]!.message };
  const row = await listingWithAgent(id);
  if (!row || row.l.status !== "pending") return { ok: false, error: "This listing is no longer waiting for review." };
  await db.update(listings).set({ status: "rejected", rejectionReason: r.data }).where(eq(listings.id, id));
  await sendEmail({
    to: row.email,
    subject: `${row.l.title} needs changes`,
    react: ListingDecisionEmail({ name: row.name, listingTitle: row.l.title, approved: false, reason: r.data, url: `${publicEnv.siteUrl}/dashboard/listings/${id}/edit` }),
    text: `"${row.l.title}" was not approved: ${r.data}\nEdit it here: ${publicEnv.siteUrl}/dashboard/listings/${id}/edit`,
  }).catch((e) => console.error(e));
  revalidateAdmin();
  return { ok: true };
}

/** Reports: dismiss them (back on the map), take the listing down, or confirm it's fake and suspend the agent. */
export async function resolveReports(id: string, outcome: "dismiss" | "takedown" | "fake", why?: string): Promise<R> {
  await assertRole("admin");
  const row = await listingWithAgent(id);
  if (!row) return { ok: false, error: "Listing not found." };
  if (outcome !== "dismiss") {
    const r = reason.safeParse(why);
    if (!r.success) return { ok: false, error: r.error.issues[0]!.message };
    why = r.data;
  }
  await db.update(reports).set({ resolved: true }).where(eq(reports.listingId, id));
  if (outcome === "dismiss") {
    await db.update(listings).set({ hiddenByReports: false }).where(eq(listings.id, id));
  } else {
    await db.update(listings).set({ hiddenByReports: false, status: "rejected", rejectionReason: why }).where(eq(listings.id, id));
    if (outcome === "fake") {
      const s = await suspendAgent(row.l.agentId, `Fake listing confirmed: ${why}`);
      if (!s.ok) return s;
    }
  }
  revalidateAdmin();
  revalidatePath(`/listing/${row.l.slug}`);
  return { ok: true };
}

/* ---------- Areas ---------- */

const areaSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2, "Enter the area name.").max(60),
  lng: z.coerce.number().min(2.7).max(4.4),
  lat: z.coerce.number().min(6.35).max(6.75),
  defaultZoom: z.coerce.number().int().min(10).max(17),
  isActive: z.boolean(),
});

export async function saveArea(input: z.input<typeof areaSchema>): Promise<R> {
  await assertRole("admin");
  const p = areaSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]!.path[0] === "lat" || p.error.issues[0]!.path[0] === "lng" ? "Place the centre within Lagos." : p.error.issues[0]!.message };
  const v = { name: p.data.name, centre: { x: p.data.lng, y: p.data.lat }, defaultZoom: p.data.defaultZoom, isActive: p.data.isActive };
  if (p.data.id) {
    await db.update(areas).set(v).where(eq(areas.id, p.data.id));
  } else {
    const slug = slugify(p.data.name);
    const [hit] = await db.select({ id: areas.id }).from(areas).where(eq(areas.slug, slug));
    if (hit) return { ok: false, error: "There’s already an area with that name." };
    await db.insert(areas).values({ ...v, slug });
  }
  revalidatePath("/admin/areas");
  revalidatePath("/search");
  revalidatePath("/");
  return { ok: true };
}
