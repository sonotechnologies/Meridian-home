import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  agentProfiles,
  areas,
  listingImages,
  listingRentTerms,
  listingSaleTerms,
  listingShortletTerms,
  listings,
  users,
} from "@/db/schema";
import { publicVisible, summariesWhere } from "./search";
import type { CurrentUser } from "./session";

/** Everything the listing page shows. The exact location is never selected. */
export const getListingBySlug = cache(async (slug: string) => {
  const [row] = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      agentId: listings.agentId,
      type: listings.type,
      propertyType: listings.propertyType,
      title: listings.title,
      description: listings.description,
      price: listings.price,
      status: listings.status,
      hiddenByReports: listings.hiddenByReports,
      sandbox: listings.sandbox,
      lng: sql<number>`ST_X(${listings.publicLocation})`,
      lat: sql<number>`ST_Y(${listings.publicLocation})`,
      streetName: listings.streetName,
      showStreet: listings.showStreet,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      toilets: listings.toilets,
      parking: listings.parking,
      sizeSqm: listings.sizeSqm,
      furnished: listings.furnished,
      serviced: listings.serviced,
      amenities: listings.amenities,
      isDemo: listings.isDemo,
      publishedAt: listings.publishedAt,
      expiresAt: listings.expiresAt,
      areaId: listings.areaId,
      areaName: areas.name,
      areaSlug: areas.slug,
      agent: {
        name: agentProfiles.fullName,
        slug: agentProfiles.slug,
        agency: agentProfiles.agencyName,
        photoUrl: agentProfiles.photoUrl,
        whatsapp: agentProfiles.whatsapp,
        status: agentProfiles.status,
        isDemo: agentProfiles.isDemo,
        email: users.email,
      },
      rent: {
        agencyFee: listingRentTerms.agencyFee,
        legalFee: listingRentTerms.legalFee,
        cautionDeposit: listingRentTerms.cautionDeposit,
        serviceCharge: listingRentTerms.serviceCharge,
        totalUpfront: listingRentTerms.totalUpfront,
      },
      sale: { titleDocument: listingSaleTerms.titleDocument, negotiable: listingSaleTerms.negotiable },
      shortlet: {
        minNights: listingShortletTerms.minNights,
        cleaningFee: listingShortletTerms.cleaningFee,
        cautionDeposit: listingShortletTerms.cautionDeposit,
      },
    })
    .from(listings)
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(agentProfiles, eq(agentProfiles.userId, listings.agentId))
    .leftJoin(users, eq(users.id, listings.agentId))
    .leftJoin(listingRentTerms, eq(listingRentTerms.listingId, listings.id))
    .leftJoin(listingSaleTerms, eq(listingSaleTerms.listingId, listings.id))
    .leftJoin(listingShortletTerms, eq(listingShortletTerms.listingId, listings.id))
    .where(eq(listings.slug, slug))
    .limit(1);
  if (!row) return null;

  const [images, [activeCount]] = await Promise.all([
    db.select({ url: listingImages.url }).from(listingImages).where(eq(listingImages.listingId, row.id)).orderBy(asc(listingImages.position)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(eq(listings.agentId, row.agentId), publicVisible())),
  ]);

  return {
    ...row,
    lng: Number(row.lng),
    lat: Number(row.lat),
    images: images.map((i) => i.url),
    agentListingCount: activeCount?.n ?? 0,
  };
});

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

/** "public" pages show normally; "gone" shows the expired view; "preview" is for the owner or an admin only. */
export function listingVisibility(l: ListingDetail, viewer: CurrentUser | null): "public" | "gone" | "preview" | "hidden" {
  const isOwnerOrAdmin = viewer && (viewer.id === l.agentId || viewer.role === "admin");
  const expired = l.status === "expired" || l.status === "closed" || (l.status === "active" && l.expiresAt && l.expiresAt < new Date());
  if (l.status === "active" && !expired && !l.hiddenByReports && !l.sandbox) return "public";
  if (expired && !l.sandbox && !l.hiddenByReports) return "gone";
  return isOwnerOrAdmin ? "preview" : "hidden";
}

export async function similarListings(l: ListingDetail, limit = 4) {
  return summariesWhere(
    and(publicVisible(), eq(listings.type, l.type), ne(listings.id, l.id), l.areaId ? eq(listings.areaId, l.areaId) : undefined)!,
    limit,
  );
}

export async function recordView(id: string) {
  await db
    .update(listings)
    .set({ viewCount: sql`${listings.viewCount} + 1` })
    .where(eq(listings.id, id));
}
