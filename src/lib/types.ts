import type { ListingType, PropertyType } from "./format";

/** What a search result, card, pin and preview card need. Public location only. */
export type ListingSummary = {
  id: string;
  slug: string;
  type: ListingType;
  propertyType: PropertyType;
  title: string;
  area: string;
  price: number;
  totalUpfront: number | null;
  beds: number;
  baths: number;
  size: number | null;
  /** Public (offset) location. */
  lng: number;
  lat: number;
  cover: string | null;
  isDemo: boolean;
  publishedAt: string | null;
};
