import { z } from "zod";
import { PROPERTY_TYPES } from "./format";

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

// Zod-free helpers live in filter-params so client bundles that only build URLs skip Zod.
export { describeFilters, filtersToParams, PRICE_PRESETS, PRICE_RANGE, priceLabel } from "./filter-params";
