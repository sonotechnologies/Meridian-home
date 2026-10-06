/** Fee as entered by the agent: a naira amount or a percentage of yearly rent. */
export type FeeInput = { mode: "amount"; value: number } | { mode: "percent"; value: number };

export function feeAmount(fee: FeeInput | undefined, rent: number): number {
  if (!fee) return 0;
  return fee.mode === "percent" ? Math.round((rent * fee.value) / 100) : Math.round(fee.value);
}

export type RentFees = {
  agencyFee: number;
  legalFee: number;
  cautionDeposit: number;
  serviceCharge: number;
};

/** Total upfront = yearly rent + agency fee + legal fee + caution deposit + service charge. */
export function totalUpfront(rent: number, f: RentFees): number {
  return rent + f.agencyFee + f.legalFee + f.cautionDeposit + f.serviceCharge;
}

export const FEE_LABELS: [keyof RentFees | "rent", string][] = [
  ["rent", "Rent, 1 year"],
  ["agencyFee", "Agency fee"],
  ["legalFee", "Legal fee"],
  ["cautionDeposit", "Caution deposit (refundable)"],
  ["serviceCharge", "Service charge, 1 year"],
];

/** Label with the percentage of rent appended when it is a round number, e.g. "Agency fee (10%)". */
export function feeLabel(key: keyof RentFees, base: string, amount: number, rent: number): string {
  if ((key === "agencyFee" || key === "legalFee") && rent > 0 && amount > 0) {
    const pct = (amount / rent) * 100;
    if (Math.abs(pct - Math.round(pct)) < 0.01) return `${base} (${Math.round(pct)}%)`;
  }
  return base;
}

/** A listing expires 30 days after publishing or renewing. */
export const LISTING_LIFETIME_DAYS = 30;
/** Agents get an email this many days before expiry. */
export const EXPIRY_REMINDER_DAYS = 5;
/** First listings go to the admin queue until this many are approved. */
export const APPROVALS_BEFORE_AUTOPUBLISH = 3;
/** Unresolved reports that hide a listing until review. */
export const REPORTS_TO_HIDE = 3;

export function expiryFrom(date: Date): Date {
  return new Date(date.getTime() + LISTING_LIFETIME_DAYS * 86_400_000);
}

/**
 * Public location: the exact pin shifted by a random offset of up to 150 m.
 * Generated once when the pin is first set and stored, so it never changes
 * between requests (which would let someone average many requests).
 */
export function publicOffset(
  lng: number,
  lat: number,
  rand: () => number = Math.random,
  maxMetres = 150,
): { x: number; y: number } {
  // sqrt gives a uniform spread over the disc rather than bunching at the centre.
  const r = maxMetres * Math.sqrt(rand());
  const theta = rand() * 2 * Math.PI;
  const dLat = (r * Math.cos(theta)) / 111_320;
  const dLng = (r * Math.sin(theta)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { x: lng + dLng, y: lat + dLat };
}

/** Haversine distance in metres, used by tests and the admin view. */
export function distanceMetres(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.y - a.y);
  const dLng = toRad(b.x - a.x);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.y)) * Math.cos(toRad(b.y)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const AMENITIES = [
  "Borehole water",
  "Prepaid meter",
  "Generator",
  "Inverter",
  "Security",
  "Gated estate",
  "Parking",
  "Swimming pool",
  "Gym",
  "Fitted kitchen",
  "Air conditioning",
  "POP ceiling",
  "Wardrobes",
  "BQ (boys' quarters)",
  "Balcony",
  "Wi-Fi",
  "Elevator",
  "CCTV",
] as const;
