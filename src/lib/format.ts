/** Full price: ₦2,500,000. */
export function naira(n: number): string {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

/** Short price for pins and tight spaces: ₦2.5M, ₦850K, ₦65K, ₦1.2B. */
export function nairaShort(n: number): string {
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units) {
    if (n >= size) {
      const v = n / size;
      // One decimal under 100 when it matters (₦2.5M, ₦10.5M), whole numbers otherwise (₦85M, ₦850K).
      const s = v < 100 ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString();
      return `₦${s}${suffix}`;
    }
  }
  return "₦" + Math.round(n).toString();
}

export type ListingType = "rent" | "sale" | "shortlet";

/** Unit shown after a price, in muted Inter. Sale prices have no unit. */
export function priceUnit(type: ListingType): string {
  return type === "rent" ? "/ year" : type === "shortlet" ? "/ night" : "";
}

export const TYPE_LABEL: Record<ListingType, string> = { rent: "Rent", sale: "Buy", shortlet: "Shortlet" };
export const TYPE_TAG: Record<ListingType, string> = { rent: "Rent", sale: "Sale", shortlet: "Shortlet" };

export const PROPERTY_TYPES = [
  ["apartment", "Apartment"],
  ["self-contain", "Self-contain"],
  ["duplex", "Duplex"],
  ["detached-house", "Detached house"],
  ["terrace", "Terrace"],
  ["bungalow", "Bungalow"],
  ["land", "Land"],
  ["commercial", "Commercial space"],
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number][0];
export const PROPERTY_LABEL = Object.fromEntries(PROPERTY_TYPES) as Record<PropertyType, string>;

export const TITLE_DOCUMENTS = [
  ["c-of-o", "C of O"],
  ["governors-consent", "Governor's Consent"],
  ["deed-of-assignment", "Deed of Assignment"],
  ["registered-survey", "Registered Survey"],
  ["excision", "Excision"],
  ["other", "Other"],
] as const;

/** "today", "yesterday", "3 days ago", "1 week ago", "5 weeks ago". */
export function relativeDays(date: Date, now: Date = new Date()): string {
  const days = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysLeft(expiresAt: Date | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** 11 digits starting with 0, or 13 starting with 234. Returns +234 E.164 form, or null. */
export function normaliseNigerianPhone(input: string): string | null {
  const d = input.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "0") return "+234" + d.slice(1);
  if (d.length === 13 && d.startsWith("234")) return "+" + d;
  return null;
}
