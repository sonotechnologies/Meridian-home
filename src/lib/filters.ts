import { z } from "zod";
import { naira, nairaShort, PROPERTY_TYPES, type ListingType } from "./format";

/**
 * Search state. Everything lives in the URL so a shared link reproduces the
 * same filters and map position.
 *
 *   /search?type=rent&area=lekki&min=1000000&max=3000000&basis=total
 *          &ptype=apartment,duplex&beds=2&sort=price-asc&page=2&at=6.4474,3.4723,13.5
 */
const propertyTypeValues = PROPERTY_TYPES.map(([v]) => v) as [string, ...string[]];

const intParam = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().nonnegative().optional(),
);

export const filtersSchema = z.object({
  type: z.enum(["rent", "sale", "shortlet"]).catch("rent").default("rent"),
  area: z.string().regex(/^[a-z0-9-]+$/).optional().catch(undefined),
  min: intParam.catch(undefined),
  max: intParam.catch(undefined),
  /** Rent only: filter on yearly rent or on total upfront cost. */
  basis: z.enum(["rent", "total"]).catch("rent").default("rent"),
  ptype: z
    .preprocess(
      (v) => (typeof v === "string" && v ? v.split(",") : undefined),
      z.array(z.enum(propertyTypeValues)).optional(),
    )
    .catch(undefined),
  beds: z.preprocess((v) => (v ? Number(v) : undefined), z.number().int().min(1).max(5).optional()).catch(undefined),
  sort: z.enum(["newest", "price-asc", "price-desc"]).catch("newest").default("newest"),
  page: z.preprocess((v) => (v ? Number(v) : 1), z.number().int().min(1).max(500)).catch(1).default(1),
});

export type Filters = z.infer<typeof filtersSchema>;

export const boundsSchema = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .pipe(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)]));
export type BBox = [west: number, south: number, east: number, north: number];

/** Map position: "lat,lng,zoom". */
export const atSchema = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .pipe(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(3).max(20)]));

export function parseFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): Filters {
  const obj: Record<string, string | undefined> = {};
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => (obj[k] = v));
  } else {
    for (const [k, v] of Object.entries(params)) obj[k] = Array.isArray(v) ? v[0] : v;
  }
  return filtersSchema.parse(obj);
}

/** Back to URL params, leaving out defaults so links stay short. */
export function filtersToParams(f: Partial<Filters>): URLSearchParams {
  const p = new URLSearchParams();
  if (f.type && f.type !== "rent") p.set("type", f.type);
  if (f.area) p.set("area", f.area);
  if (f.min != null) p.set("min", String(f.min));
  if (f.max != null) p.set("max", String(f.max));
  if (f.type === "rent" && f.basis === "total") p.set("basis", "total");
  if (f.ptype?.length) p.set("ptype", f.ptype.join(","));
  if (f.beds) p.set("beds", String(f.beds));
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p;
}

/** Price presets change with listing type. */
export const PRICE_PRESETS: Record<ListingType, { label: string; min?: number; max?: number }[]> = {
  rent: [
    { label: "Under ₦1M", max: 1_000_000 },
    { label: "₦1M to ₦3M", min: 1_000_000, max: 3_000_000 },
    { label: "₦3M to ₦6M", min: 3_000_000, max: 6_000_000 },
    { label: "Over ₦6M", min: 6_000_000 },
  ],
  sale: [
    { label: "Under ₦50M", max: 50_000_000 },
    { label: "₦50M to ₦100M", min: 50_000_000, max: 100_000_000 },
    { label: "₦100M to ₦200M", min: 100_000_000, max: 200_000_000 },
    { label: "Over ₦200M", min: 200_000_000 },
  ],
  shortlet: [
    { label: "Under ₦50K", max: 50_000 },
    { label: "₦50K to ₦100K", min: 50_000, max: 100_000 },
    { label: "Over ₦100K", min: 100_000 },
  ],
};

/** Slider range per type. */
export const PRICE_RANGE: Record<ListingType, { min: number; max: number; step: number }> = {
  rent: { min: 0, max: 15_000_000, step: 100_000 },
  sale: { min: 0, max: 500_000_000, step: 5_000_000 },
  shortlet: { min: 0, max: 300_000, step: 5_000 },
};

export function priceLabel(f: Pick<Filters, "min" | "max" | "type">): string | null {
  if (f.min == null && f.max == null) return null;
  if (f.min != null && f.max != null) return `${nairaShort(f.min)} to ${nairaShort(f.max)}`;
  if (f.min != null) return `Over ${nairaShort(f.min)}`;
  return `Under ${nairaShort(f.max!)}`;
}

export function describeFilters(f: Filters, areaName?: string): string {
  const parts = [f.type === "rent" ? "To rent" : f.type === "sale" ? "To buy" : "Shortlets"];
  if (areaName) parts.push(`in ${areaName}`);
  const price = priceLabel(f);
  if (price) parts.push(price + (f.type === "rent" && f.basis === "total" ? " total" : ""));
  if (f.beds) parts.push(`${f.beds}+ beds`);
  return parts.join(", ");
}

export { naira };
