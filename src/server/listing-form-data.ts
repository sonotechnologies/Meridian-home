import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentProfiles, areas, listingImages, listingRentTerms, listingSaleTerms, listingShortletTerms, listings } from "@/db/schema";
import { EMPTY_FORM, type AreaOpt, type FormState } from "@/lib/listing-form-state";
import { APPROVALS_BEFORE_AUTOPUBLISH } from "@/lib/listing-rules";

export async function formAreas(): Promise<AreaOpt[]> {
  const rows = await db
    .select({ id: areas.id, name: areas.name, lng: sql<number>`ST_X(${areas.centre})`, lat: sql<number>`ST_Y(${areas.centre})` })
    .from(areas)
    .where(eq(areas.isActive, true))
    .orderBy(asc(areas.id));
  return rows.map((r) => ({ ...r, lng: Number(r.lng), lat: Number(r.lat) }));
}

export async function isTrusted(agentId: string, isDemo: boolean) {
  if (isDemo) return true;
  const [p] = await db.select({ n: agentProfiles.approvedListingCount }).from(agentProfiles).where(eq(agentProfiles.userId, agentId)).limit(1);
  return (p?.n ?? 0) >= APPROVALS_BEFORE_AUTOPUBLISH;
}

/** A fee shown as a percentage when it's a round share of rent (as agents usually quote it). */
function feeState(amount: number, rent: number) {
  if (rent > 0 && amount > 0) {
    const pct = (amount / rent) * 100;
    if (Math.abs(pct - Math.round(pct)) < 0.001 && pct <= 30) return { mode: "percent" as const, value: String(Math.round(pct)) };
  }
  return { mode: "amount" as const, value: amount ? String(amount) : "0" };
}

/** The agent's own listing, as form state. The exact pin is fine here: it's the owner. */
export async function loadListingForm(agentId: string, id: string) {
  const [l] = await db
    .select({
      l: listings,
      lng: sql<number | null>`ST_X(${listings.location})`,
      lat: sql<number | null>`ST_Y(${listings.location})`,
    })
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.agentId, agentId)))
    .limit(1);
  if (!l) return null;
  const [rent, sale, shortlet, images] = await Promise.all([
    db.select().from(listingRentTerms).where(eq(listingRentTerms.listingId, id)),
    db.select().from(listingSaleTerms).where(eq(listingSaleTerms.listingId, id)),
    db.select().from(listingShortletTerms).where(eq(listingShortletTerms.listingId, id)),
    db.select({ url: listingImages.url }).from(listingImages).where(eq(listingImages.listingId, id)).orderBy(asc(listingImages.position)),
  ]);
  const x = l.l;
  const r = rent[0];
  const form: FormState = {
    ...EMPTY_FORM,
    type: x.type,
    propertyType: x.propertyType,
    title: x.title,
    description: x.description,
    areaId: x.areaId,
    lng: l.lng != null ? Number(l.lng) : null,
    lat: l.lat != null ? Number(l.lat) : null,
    streetName: x.streetName ?? "",
    showStreet: x.showStreet,
    bedrooms: x.bedrooms,
    bathrooms: x.bathrooms,
    toilets: x.toilets,
    parking: x.parking,
    sizeSqm: x.sizeSqm ? String(x.sizeSqm) : "",
    furnished: x.furnished,
    serviced: x.serviced,
    amenities: x.amenities,
    price: x.price ? String(x.price) : "",
    rent: r
      ? {
          agencyFee: feeState(r.agencyFee, x.price),
          legalFee: feeState(r.legalFee, x.price),
          cautionDeposit: feeState(r.cautionDeposit, 0),
          serviceCharge: feeState(r.serviceCharge, 0),
        }
      : EMPTY_FORM.rent,
    sale: sale[0] ? { titleDocument: sale[0].titleDocument, negotiable: sale[0].negotiable } : EMPTY_FORM.sale,
    shortlet: shortlet[0]
      ? { minNights: String(shortlet[0].minNights), cleaningFee: String(shortlet[0].cleaningFee), cautionDeposit: String(shortlet[0].cautionDeposit) }
      : EMPTY_FORM.shortlet,
    images: images.map((i) => i.url),
  };
  return { form, draftStep: x.draftStep, status: x.status };
}
