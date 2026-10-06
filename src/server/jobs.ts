import "server-only";
import { and, eq, gt, isNotNull, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { agentProfiles, listings, savedSearches, users } from "@/db/schema";
import { seedDemo } from "@/db/seed-data";
import { AlertEmail, ExpiryReminderEmail } from "@/emails/templates";
import { filtersToParams, parseFilters, type BBox } from "@/lib/filters";
import { naira, priceUnit } from "@/lib/format";
import { EXPIRY_REMINDER_DAYS } from "@/lib/listing-rules";
import { publicEnv } from "@/lib/public-env";
import { sendEmail } from "./email";
import { deletePrivateDocument } from "./images";
import { searchListings } from "./search";
import { sign } from "./tokens";

const DAY = 86_400_000;

/**
 * Daily: email each buyer the new listings matching each saved search with
 * alerts on. "New" means published since the last alert (or since saving).
 */
export async function runSearchAlerts(now = new Date()) {
  const rows = await db
    .select({ s: savedSearches, email: users.email })
    .from(savedSearches)
    .innerJoin(users, eq(users.id, savedSearches.userId))
    .where(eq(savedSearches.alertsOn, true));

  let sent = 0;
  for (const { s, email } of rows) {
    const since = s.lastAlertedAt ?? s.createdAt;
    const f = parseFilters(s.filters);
    const bbox: BBox | undefined = s.bounds ? [s.bounds.west, s.bounds.south, s.bounds.east, s.bounds.north] : undefined;
    const { pins } = await searchListings({ ...f, sort: "newest", page: 1 }, bbox);
    const fresh = pins.filter((p) => p.publishedAt && new Date(p.publishedAt) > since && new Date(p.publishedAt) <= now);
    if (fresh.length) {
      const q = filtersToParams(f);
      if (!q.has("type")) q.set("type", f.type);
      const searchUrl = `${publicEnv.siteUrl}/search?${q}`;
      const unsubscribeUrl = `${publicEnv.siteUrl}/api/unsubscribe?token=${s.unsubscribeToken}`;
      const items = fresh.slice(0, 10).map((p) => ({
        title: p.title,
        area: p.area,
        price: `${naira(p.price)}${priceUnit(p.type) ? " " + priceUnit(p.type) : ""}`,
        url: `${publicEnv.siteUrl}/listing/${p.slug}`,
      }));
      await sendEmail({
        to: email,
        subject: `${fresh.length} new ${fresh.length === 1 ? "home" : "homes"}: ${s.name}`,
        react: AlertEmail({ searchName: s.name, listings: items, searchUrl, unsubscribeUrl }),
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        text: `${items.map((i) => `${i.title}, ${i.area}, ${i.price}\n${i.url}`).join("\n\n")}\n\nSee them on the map: ${searchUrl}\nStop these emails: ${unsubscribeUrl}`,
      });
      sent++;
    }
    await db.update(savedSearches).set({ lastAlertedAt: now }).where(eq(savedSearches.id, s.id));
  }
  return { searches: rows.length, emailsSent: sent };
}

/**
 * Daily: expire listings past their date, and remind agents five days before,
 * with a one-click "Still available" link.
 */
export async function runExpiry(now = new Date()) {
  const expired = await db
    .update(listings)
    .set({ status: "expired" })
    .where(and(eq(listings.status, "active"), lt(listings.expiresAt, now)))
    .returning({ id: listings.id });

  const due = await db
    .select({ id: listings.id, title: listings.title, expiresAt: listings.expiresAt, email: users.email, name: users.name })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.agentId))
    .where(
      and(
        eq(listings.status, "active"),
        eq(listings.sandbox, false),
        isNull(listings.expiryRemindedAt),
        lte(listings.expiresAt, new Date(now.getTime() + EXPIRY_REMINDER_DAYS * DAY)),
        gt(listings.expiresAt, now),
      ),
    );

  for (const l of due) {
    const renewUrl = `${publicEnv.siteUrl}/api/renew?token=${sign("renew", l.id, EXPIRY_REMINDER_DAYS + 30)}`;
    const expiresOn = l.expiresAt!.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
    await sendEmail({
      to: l.email,
      subject: `Still available? ${l.title} expires ${expiresOn}`,
      react: ExpiryReminderEmail({ agentName: l.name, listingTitle: l.title, expiresOn, renewUrl }),
      text: `Your listing "${l.title}" expires on ${expiresOn}. If it's still available, renew it for 30 days: ${renewUrl}`,
    });
    await db.update(listings).set({ expiryRemindedAt: now }).where(eq(listings.id, l.id));
  }
  return { expired: expired.length, reminded: due.length };
}

/** Daily: ID documents are deleted 30 days after the admin's decision. */
export async function runIdDocumentCleanup(now = new Date()) {
  const old = await db
    .select({ userId: agentProfiles.userId, key: agentProfiles.idDocumentUrl })
    .from(agentProfiles)
    .where(and(isNotNull(agentProfiles.idDocumentUrl), isNotNull(agentProfiles.decidedAt), lt(agentProfiles.decidedAt, new Date(now.getTime() - 30 * DAY))));
  for (const o of old) {
    await deletePrivateDocument(o.key!);
    await db.update(agentProfiles).set({ idDocumentUrl: null }).where(eq(agentProfiles.userId, o.userId));
  }
  return { deleted: old.length };
}

/** Nightly: put the demo data back, discarding demo agents' changes. */
export async function runDemoReset() {
  await seedDemo(db);
  return { ok: true };
}
