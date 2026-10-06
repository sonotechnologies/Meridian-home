import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seedDemo } from "@/db/seed-data";
import { db } from "@/db";
import { agentProfiles, listings, savedSearches } from "@/db/schema";
import { outbox } from "../email";
import { runExpiry, runIdDocumentCleanup, runSearchAlerts } from "../jobs";
import { sign, verify } from "../tokens";

// Each file starts from fresh demo data, so tests don't depend on run order.
beforeAll(() => seedDemo(db));

const DAY = 86_400_000;

beforeEach(() => {
  outbox.length = 0;
});

describe("saved search alerts", () => {
  it("emails only listings published since the last alert, then moves the marker", async () => {
    const [newest] = await db.select().from(listings).where(sql`status = 'active' and type = 'rent'`).orderBy(sql`published_at desc`).limit(1);
    const [s] = await db
      .insert(savedSearches)
      .values({
        userId: "demo_buyer",
        name: "To rent, Lagos",
        filters: { type: "rent" },
        unsubscribeToken: `tok-${Date.now()}-abcdefghijklmnop`,
        createdAt: new Date(newest!.publishedAt!.getTime() - 1000),
      })
      .returning();

    await runSearchAlerts();
    const mine = outbox.filter((e) => e.subject.includes("To rent, Lagos"));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.to).toBe("buyer@demo.meridian.ng");
    expect(mine[0]!.text).toContain(newest!.slug);
    expect(mine[0]!.headers?.["List-Unsubscribe"]).toContain(s!.unsubscribeToken);

    // Nothing new since: no second email.
    outbox.length = 0;
    await runSearchAlerts();
    expect(outbox.filter((e) => e.subject.includes("To rent, Lagos"))).toHaveLength(0);

    // Alerts off: skipped entirely.
    await db.update(savedSearches).set({ alertsOn: false, lastAlertedAt: new Date(0) }).where(eq(savedSearches.id, s!.id));
    await runSearchAlerts();
    expect(outbox.filter((e) => e.subject.includes("To rent, Lagos"))).toHaveLength(0);
  });
});

describe("expiry", () => {
  it("expires listings past their date and reminds agents five days before, once", async () => {
    const [a, b] = await db.select().from(listings).where(sql`status = 'active' and not sandbox`).limit(2);
    await db.update(listings).set({ expiresAt: new Date(Date.now() - DAY) }).where(eq(listings.id, a!.id));
    await db.update(listings).set({ expiresAt: new Date(Date.now() + 3 * DAY), expiryRemindedAt: null }).where(eq(listings.id, b!.id));

    const r = await runExpiry();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    const [after] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, a!.id));
    expect(after!.status).toBe("expired");

    const reminder = outbox.find((e) => e.text.includes(b!.title));
    expect(reminder).toBeDefined();
    const token = decodeURIComponent(reminder!.text.match(/token=([^\s]+)/)![1]!);
    expect(verify(token, "renew")).toBe(b!.id);

    outbox.length = 0;
    await runExpiry();
    expect(outbox.find((e) => e.text.includes(b!.title))).toBeUndefined();
  });
});

describe("signed tokens", () => {
  it("rejects tampering, the wrong purpose and expiry", () => {
    const t = sign("renew", "abc", 1);
    expect(verify(t, "renew")).toBe("abc");
    expect(verify(t, "other")).toBeNull();
    expect(verify(t.slice(0, -2) + "xx", "renew")).toBeNull();
    expect(verify(sign("renew", "abc", -1), "renew")).toBeNull();
  });
});

describe("ID document cleanup", () => {
  it("deletes ID documents 30 days after the decision", async () => {
    const [p] = await db.select().from(agentProfiles).where(eq(agentProfiles.status, "pending")).limit(1);
    await db
      .update(agentProfiles)
      .set({ idDocumentUrl: "private:nobody/none.jpg", decidedAt: new Date(Date.now() - 31 * DAY) })
      .where(eq(agentProfiles.userId, p!.userId));
    const r = await runIdDocumentCleanup();
    expect(r.deleted).toBeGreaterThanOrEqual(1);
    const [after] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, p!.userId));
    expect(after!.idDocumentUrl).toBeNull();
  });
});
