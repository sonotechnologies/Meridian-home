import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { areas, listingImages, listingRentTerms, listings } from "@/db/schema";
import type { BBox, Filters } from "@/lib/filters";
import type { ListingSummary } from "@/lib/types";

export const MAX_PINS = 200;
export const PAGE_SIZE = 20;

/** Conditions every public query shares: active, not hidden, not a demo sandbox, not past expiry. */
export function publicVisible(): SQL {
  return and(
    eq(listings.status, "active"),
    eq(listings.hiddenByReports, false),
    eq(listings.sandbox, false),
    or(isNull(listings.expiresAt), sql`${listings.expiresAt} > now()`),
  )!;
}

function filterConditions(f: Filters, bbox?: BBox): SQL[] {
  const c: SQL[] = [publicVisible(), eq(listings.type, f.type)];
  if (bbox) {
    const [w, s, e, n] = bbox;
    c.push(sql`${listings.publicLocation} && ST_MakeEnvelope(${w}, ${s}, ${e}, ${n}, 4326)`);
  }
  if (f.area) c.push(eq(areas.slug, f.area));
  const priceCol = f.type === "rent" && f.basis === "total" ? listingRentTerms.totalUpfront : listings.price;
  if (f.min != null) c.push(gte(priceCol, f.min));
  if (f.max != null) c.push(lte(priceCol, f.max));
  if (f.ptype?.length) c.push(inArray(listings.propertyType, f.ptype as (typeof listings.propertyType.enumValues)[number][]));
  if (f.beds) c.push(gte(listings.bedrooms, f.beds));
  return c;
}

const coverSq = sql<string | null>`(select ${listingImages.url} from ${listingImages} where ${listingImages.listingId} = ${listings.id} order by ${listingImages.position} limit 1)`;

/** Only public fields; the exact `location` column is never selected here. */
const summaryColumns = {
  id: listings.id,
  slug: listings.slug,
  type: listings.type,
  propertyType: listings.propertyType,
  title: listings.title,
  area: areas.name,
  price: listings.price,
  totalUpfront: listingRentTerms.totalUpfront,
  beds: listings.bedrooms,
  baths: listings.bathrooms,
  size: listings.sizeSqm,
  lng: sql<number>`ST_X(${listings.publicLocation})`,
  lat: sql<number>`ST_Y(${listings.publicLocation})`,
  cover: coverSq,
  isDemo: listings.isDemo,
  publishedAt: listings.publishedAt,
};

function orderBy(f: Filters) {
  const priceCol = f.type === "rent" && f.basis === "total" ? listingRentTerms.totalUpfront : listings.price;
  if (f.sort === "price-asc") return [asc(priceCol), desc(listings.publishedAt)];
  if (f.sort === "price-desc") return [desc(priceCol), desc(listings.publishedAt)];
  return [desc(listings.publishedAt), asc(listings.id)];
}

type Row = Omit<ListingSummary, "publishedAt" | "lng" | "lat"> & { publishedAt: Date | null; lng: number | string; lat: number | string };

function toSummary(r: Row): ListingSummary {
  return {
    ...r,
    lng: Number(r.lng),
    lat: Number(r.lat),
    totalUpfront: r.totalUpfront ?? null,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
  };
}

export type SearchResult = {
  /** Every match inside the bounds (up to MAX_PINS), for pins. */
  pins: ListingSummary[];
  /** One page of the same result, for the list. */
  items: ListingSummary[];
  total: number;
  page: number;
  pageSize: number;
  truncated: boolean;
};

export async function searchListings(f: Filters, bbox?: BBox): Promise<SearchResult> {
  const where = and(...filterConditions(f, bbox));
  const base = () =>
    db
      .select(summaryColumns)
      .from(listings)
      .leftJoin(areas, eq(areas.id, listings.areaId))
      .leftJoin(listingRentTerms, eq(listingRentTerms.listingId, listings.id))
      .where(where);

  const [pinsRows, [{ total }]] = await Promise.all([
    base().orderBy(...orderBy(f)).limit(MAX_PINS + 1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(listings)
      .leftJoin(areas, eq(areas.id, listings.areaId))
      .leftJoin(listingRentTerms, eq(listingRentTerms.listingId, listings.id))
      .where(where),
  ]);

  const truncated = pinsRows.length > MAX_PINS;
  const pins = pinsRows.slice(0, MAX_PINS).map((r) => toSummary(r as Row));
  // The list pages through the same ordered result. Beyond the pin cap, fetch the page directly.
  const offset = (f.page - 1) * PAGE_SIZE;
  const items =
    offset + PAGE_SIZE <= pins.length || !truncated
      ? pins.slice(offset, offset + PAGE_SIZE)
      : (await base().orderBy(...orderBy(f)).limit(PAGE_SIZE).offset(offset)).map((r) => toSummary(r as Row));

  return { pins, items, total, page: f.page, pageSize: PAGE_SIZE, truncated };
}

export async function getAreas() {
  const rows = await db
    .select({
      id: areas.id,
      name: areas.name,
      slug: areas.slug,
      lng: sql<number>`ST_X(${areas.centre})`,
      lat: sql<number>`ST_Y(${areas.centre})`,
      zoom: areas.defaultZoom,
      // Qualified by hand: in a single-table select Drizzle leaves column names
      // unqualified, so a bare "id" here would resolve to listings.id.
      count: sql<number>`(select count(*)::int from ${listings} where ${listings.areaId} = "areas"."id" and ${publicVisible()})`,
    })
    .from(areas)
    .where(eq(areas.isActive, true))
    .orderBy(asc(areas.id));
  return rows.map((r) => ({ ...r, lng: Number(r.lng), lat: Number(r.lat) }));
}
export type AreaOption = Awaited<ReturnType<typeof getAreas>>[number];

/** Same shape for any listing ids (favourites, similar listings, alerts). */
export async function summariesWhere(where: SQL, limit = 20): Promise<ListingSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(listings)
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(listingRentTerms, eq(listingRentTerms.listingId, listings.id))
    .where(where)
    .orderBy(desc(listings.publishedAt))
    .limit(limit);
  return rows.map((r) => toSummary(r as Row));
}
