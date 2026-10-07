import { nairaShort, type ListingType } from "./format";
import type { Filters } from "./filters";

/* Search URL helpers with no Zod dependency, safe for small client bundles. */

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

