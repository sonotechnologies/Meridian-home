import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { savedSearches } from "@/db/schema";

/** One-click unsubscribe for one saved search. POST supports RFC 8058 List-Unsubscribe-Post. */
async function unsubscribe(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const rows = token.length >= 20 ? await db.update(savedSearches).set({ alertsOn: false }).where(eq(savedSearches.unsubscribeToken, token)).returning({ id: savedSearches.id }) : [];
  return rows.length ? "ok" : "invalid";
}

export async function GET(req: NextRequest) {
  const state = await unsubscribe(req);
  return NextResponse.redirect(new URL(`/email-done?what=unsubscribe&state=${state}`, req.url));
}

export async function POST(req: NextRequest) {
  const state = await unsubscribe(req);
  return NextResponse.json({ ok: state === "ok" });
}
