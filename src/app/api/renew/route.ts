import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { expiryFrom } from "@/lib/listing-rules";
import { verify } from "@/server/tokens";

/** One-click "Still available" from the expiry email. Works without signing in. */
export async function GET(req: NextRequest) {
  const id = verify(req.nextUrl.searchParams.get("token") ?? "", "renew");
  const done = (state: string) => NextResponse.redirect(new URL(`/email-done?what=renew&state=${state}`, req.url));
  if (!id) return done("invalid");
  const now = new Date();
  const rows = await db
    .update(listings)
    .set({ status: "active", publishedAt: now, expiresAt: expiryFrom(now), expiryRemindedAt: null })
    .where(and(eq(listings.id, id), inArray(listings.status, ["active", "expired"])))
    .returning({ slug: listings.slug });
  if (!rows.length) return done("closed");
  revalidatePath(`/listing/${rows[0]!.slug}`);
  return done("ok");
}
