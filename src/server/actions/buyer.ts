"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { favourites, listings, savedSearches } from "@/db/schema";
import { boundsSchema, describeFilters, filtersToParams, parseFilters } from "@/lib/filters";
import { getUser } from "@/server/session";

type Result<T = object> = ({ ok: true } & T) | { ok: false; needsLogin?: boolean; error?: string };

export async function toggleFavourite(listingId: string): Promise<Result<{ saved: boolean }>> {
  const user = await getUser();
  if (!user) return { ok: false, needsLogin: true };
  if (!z.string().uuid().safeParse(listingId).success) return { ok: false, error: "Unknown listing." };
  const existing = await db
    .select()
    .from(favourites)
    .where(and(eq(favourites.userId, user.id), eq(favourites.listingId, listingId)))
    .limit(1);
  if (existing.length) {
    await db.delete(favourites).where(and(eq(favourites.userId, user.id), eq(favourites.listingId, listingId)));
    revalidatePath("/saved");
    return { ok: true, saved: false };
  }
  const [l] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!l) return { ok: false, error: "That listing no longer exists." };
  await db.insert(favourites).values({ userId: user.id, listingId }).onConflictDoNothing();
  revalidatePath("/saved");
  return { ok: true, saved: true };
}

/** Stores the current filter set and, optionally, the map bounds. */
export async function saveSearch(input: { query: string; bbox?: string | null; areaName?: string }): Promise<Result<{ id: string }>> {
  const user = await getUser();
  if (!user) return { ok: false, needsLogin: true };
  const f = parseFilters(new URLSearchParams(input.query));
  const filters = Object.fromEntries(filtersToParams({ ...f, page: 1 }));
  if (!filters.type) filters.type = f.type;
  let bounds = null;
  if (input.bbox) {
    const b = boundsSchema.safeParse(input.bbox);
    if (b.success) {
      const [west, south, east, north] = b.data;
      bounds = { west, south, east, north };
    }
  }
  const name = describeFilters(f, input.areaName).slice(0, 120);
  const [row] = await db
    .insert(savedSearches)
    .values({ userId: user.id, name, filters, bounds, unsubscribeToken: nanoid(32) })
    .returning({ id: savedSearches.id });
  revalidatePath("/searches");
  return { ok: true, id: row!.id };
}

export async function setSearchAlerts(id: string, on: boolean): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false };
  const rows = await db
    .update(savedSearches)
    .set({ alertsOn: on, ...(on ? { lastAlertedAt: new Date() } : {}) })
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)))
    .returning({ id: savedSearches.id });
  revalidatePath("/searches");
  return { ok: rows.length === 1 };
}

export async function deleteSearch(id: string): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user || !z.string().uuid().safeParse(id).success) return { ok: false };
  await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, user.id)));
  revalidatePath("/searches");
  return { ok: true };
}
