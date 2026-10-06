import { hashPassword } from "better-auth/crypto";
import { eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { nanoid } from "nanoid";
import { slugify } from "@/lib/format";
import { expiryFrom, publicOffset, totalUpfront } from "@/lib/listing-rules";
import * as s from "./schema";

type DB = PostgresJsDatabase<typeof s>;

export const AREAS = [
  { name: "Lekki", slug: "lekki", x: 3.4723, y: 6.4474, zoom: 14 },
  { name: "Ikoyi", slug: "ikoyi", x: 3.4357, y: 6.4541, zoom: 14 },
  { name: "Victoria Island", slug: "victoria-island", x: 3.4219, y: 6.4281, zoom: 14 },
  { name: "Ikeja", slug: "ikeja", x: 3.3515, y: 6.6018, zoom: 14 },
  { name: "Yaba", slug: "yaba", x: 3.3792, y: 6.5095, zoom: 14 },
] as const;
type AreaSlug = (typeof AREAS)[number]["slug"];

export const DEMO_PASSWORD = "meridian-demo";
export const DEMO_AGENT_EMAIL = "adaeze@demo.meridian.ng";

const AGENTS = [
  { name: "Adaeze Okafor", agency: "Coastline Homes", email: DEMO_AGENT_EMAIL, wa: "+2348000000001", areas: ["lekki", "victoria-island"] },
  { name: "Tunde Bakare", agency: "Mainland Realty", email: "tunde@demo.meridian.ng", wa: "+2348000000002", areas: ["yaba", "ikeja"] },
  { name: "Ngozi Eze", agency: "Island Keys", email: "ngozi@demo.meridian.ng", wa: "+2348000000003", areas: ["ikoyi", "victoria-island"] },
  { name: "Ibrahim Musa", agency: "Northgate Properties", email: "ibrahim@demo.meridian.ng", wa: "+2348000000004", areas: ["ikeja", "lekki"] },
] as const;

/** Deterministic PRNG so the seed looks the same on every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Seed = {
  type: "rent" | "sale" | "shortlet";
  propertyType: (typeof s.propertyTypeEnum.enumValues)[number];
  title: string;
  area: AreaSlug;
  price: number;
  beds: number;
  baths: number;
  size: number;
  /** Rent: [agency, legal, caution, service]. */
  fees?: [number, number, number, number];
  ageDays: number;
  description?: string;
  amenities?: string[];
  status?: "active" | "pending" | "expired";
};

const pct = (rent: number, p: number) => Math.round((rent * p) / 100);
const rentFees = (rent: number, caution: number, service: number): [number, number, number, number] => [
  pct(rent, 10),
  pct(rent, 10),
  caution,
  service,
];

/** The prototype's listings first (Surulere moved to Ikeja per the build brief), then the rest. */
const LISTINGS: Seed[] = [
  { type: "rent", propertyType: "apartment", title: "3 bedroom apartment with BQ", area: "lekki", price: 4_500_000, beds: 3, baths: 3, size: 140, fees: rentFees(4_500_000, 500_000, 450_000), ageDays: 3, description: "Quiet close, constant water from a borehole, prepaid meter and a shared estate generator. All rooms en suite with a fitted kitchen.", amenities: ["Borehole water", "Prepaid meter", "Generator", "Fitted kitchen", "BQ (boys' quarters)", "Security", "Parking"] },
  { type: "rent", propertyType: "apartment", title: "2 bedroom flat with BQ", area: "yaba", price: 2_800_000, beds: 2, baths: 2, size: 95, fees: rentFees(2_800_000, 300_000, 260_000), ageDays: 2 },
  { type: "rent", propertyType: "apartment", title: "2 bedroom flat, new build", area: "ikoyi", price: 3_100_000, beds: 2, baths: 2, size: 110, fees: rentFees(3_100_000, 350_000, 210_000), ageDays: 0 },
  { type: "rent", propertyType: "self-contain", title: "Self-contain off Allen Avenue", area: "ikeja", price: 1_200_000, beds: 1, baths: 1, size: 32, fees: rentFees(1_200_000, 200_000, 100_000), ageDays: 5 },
  { type: "rent", propertyType: "apartment", title: "Mini flat in a gated close", area: "lekki", price: 3_500_000, beds: 1, baths: 1, size: 48, fees: rentFees(3_500_000, 400_000, 230_000), ageDays: 12 },
  { type: "rent", propertyType: "apartment", title: "1 bedroom flat off Herbert Macaulay", area: "yaba", price: 1_800_000, beds: 1, baths: 1, size: 60, fees: rentFees(1_800_000, 250_000, 150_000), ageDays: 1 },
  { type: "sale", propertyType: "terrace", title: "4 bedroom terrace duplex", area: "ikoyi", price: 85_000_000, beds: 4, baths: 5, size: 320, ageDays: 4 },
  { type: "sale", propertyType: "detached-house", title: "5 bedroom detached house", area: "lekki", price: 120_000_000, beds: 5, baths: 6, size: 450, ageDays: 7 },
  { type: "shortlet", propertyType: "apartment", title: "1 bedroom serviced shortlet", area: "victoria-island", price: 65_000, beds: 1, baths: 1, size: 55, ageDays: 0 },
  { type: "shortlet", propertyType: "apartment", title: "2 bedroom shortlet with pool", area: "victoria-island", price: 90_000, beds: 2, baths: 2, size: 90, ageDays: 2 },
];

const RENT_TEMPLATES: [Seed["propertyType"], number, number, number, string][] = [
  ["apartment", 2, 2, 100, "2 bedroom flat"],
  ["apartment", 3, 3, 150, "3 bedroom flat with BQ"],
  ["self-contain", 1, 1, 30, "Self-contain"],
  ["apartment", 1, 1, 55, "Mini flat"],
  ["duplex", 4, 4, 260, "4 bedroom semi-detached duplex"],
  ["bungalow", 3, 2, 160, "3 bedroom bungalow"],
  ["apartment", 2, 2, 90, "2 bedroom serviced flat"],
  ["terrace", 3, 4, 210, "3 bedroom terrace"],
];
const AREA_TIER: Record<AreaSlug, number> = { ikoyi: 1.5, "victoria-island": 1.35, lekki: 1, ikeja: 0.75, yaba: 0.6 };
const BASE_RENT: Record<string, number> = {
  "2 bedroom flat": 3_000_000,
  "3 bedroom flat with BQ": 4_800_000,
  "Self-contain": 1_000_000,
  "Mini flat": 1_800_000,
  "4 bedroom semi-detached duplex": 8_000_000,
  "3 bedroom bungalow": 3_200_000,
  "2 bedroom serviced flat": 4_200_000,
  "3 bedroom terrace": 6_000_000,
};
const STREETS: Record<AreaSlug, string[]> = {
  lekki: ["Admiralty Way", "Fola Osibo Road", "Durosimi Etti Drive", "Kusenla Road"],
  ikoyi: ["Bourdillon Road", "Awolowo Road", "Glover Road", "Kingsway Road"],
  "victoria-island": ["Adeola Odeku Street", "Ajose Adeogun Street", "Akin Adesola Street", "Sanusi Fafunwa Street"],
  ikeja: ["Allen Avenue", "Opebi Road", "Isaac John Street", "Joel Ogunnaike Street"],
  yaba: ["Herbert Macaulay Way", "Sabo Road", "Montgomery Road", "Alagomeji Street"],
};
const AMENITY_POOL = ["Borehole water", "Prepaid meter", "Generator", "Security", "Gated estate", "Parking", "Fitted kitchen", "Air conditioning", "POP ceiling", "Wardrobes", "Balcony", "CCTV"];

function round(n: number, to: number) {
  return Math.round(n / to) * to;
}

function buildListings(rand: () => number): Seed[] {
  const out = [...LISTINGS];
  const areaOrder: AreaSlug[] = ["lekki", "ikoyi", "victoria-island", "ikeja", "yaba"];
  // 18 more rent listings (24 total).
  for (let i = 0; i < 18; i++) {
    const [pt, beds, baths, size, label] = RENT_TEMPLATES[i % RENT_TEMPLATES.length]!;
    const area = areaOrder[i % areaOrder.length]!;
    const price = round(BASE_RENT[label]! * AREA_TIER[area] * (0.85 + rand() * 0.3), 50_000);
    const street = STREETS[area][Math.floor(rand() * 4)]!;
    out.push({
      type: "rent",
      propertyType: pt,
      title: `${label} off ${street}`,
      area,
      price,
      beds,
      baths,
      size,
      fees: rentFees(price, round(price * 0.1, 50_000), round(price * 0.08, 10_000)),
      ageDays: Math.floor(rand() * 20),
    });
  }
  // 8 more sale listings (10 total).
  const sales: [Seed["propertyType"], number, number, number, string, number][] = [
    ["duplex", 4, 5, 300, "4 bedroom semi-detached duplex", 95_000_000],
    ["apartment", 3, 3, 170, "3 bedroom apartment", 60_000_000],
    ["land", 0, 0, 600, "600 m² plot with C of O", 70_000_000],
    ["bungalow", 3, 3, 200, "3 bedroom bungalow on a full plot", 55_000_000],
    ["terrace", 4, 4, 280, "4 bedroom terrace with BQ", 110_000_000],
    ["apartment", 2, 2, 110, "2 bedroom apartment", 42_000_000],
    ["detached-house", 5, 6, 500, "5 bedroom detached house with pool", 280_000_000],
    ["commercial", 0, 2, 240, "Office space, ground floor", 150_000_000],
  ];
  sales.forEach(([pt, beds, baths, size, title, base], i) => {
    const area = areaOrder[(i + 2) % areaOrder.length]!;
    out.push({ type: "sale", propertyType: pt, title, area, price: round(base * AREA_TIER[area], 500_000), beds, baths, size, ageDays: Math.floor(rand() * 25) });
  });
  // 4 more shortlets (6 total).
  const shorts: [number, number, number, string, AreaSlug, number][] = [
    [1, 1, 50, "Studio shortlet near the beach", "lekki", 45_000],
    [3, 3, 160, "3 bedroom shortlet with rooftop", "ikoyi", 150_000],
    [2, 2, 85, "2 bedroom shortlet, 24-hour power", "lekki", 75_000],
    [1, 1, 45, "1 bedroom shortlet near the airport", "ikeja", 40_000],
  ];
  for (const [beds, baths, size, title, area, price] of shorts) {
    out.push({ type: "shortlet", propertyType: "apartment", title, area, price, beds, baths, size, ageDays: Math.floor(rand() * 10) });
  }
  // Queue items for the admin panel and one expired page.
  out.push({ type: "rent", propertyType: "apartment", title: "2 bedroom flat awaiting review", area: "yaba", price: 2_400_000, beds: 2, baths: 2, size: 90, fees: rentFees(2_400_000, 250_000, 150_000), ageDays: 0, status: "pending" });
  out.push({ type: "sale", propertyType: "land", title: "Half plot, Governor's Consent", area: "ikeja", price: 35_000_000, beds: 0, baths: 0, size: 300, ageDays: 1, status: "pending" });
  out.push({ type: "rent", propertyType: "apartment", title: "3 bedroom flat, taken in September", area: "ikeja", price: 2_600_000, beds: 3, baths: 3, size: 130, fees: rentFees(2_600_000, 300_000, 200_000), ageDays: 40, status: "expired" });
  return out;
}

/**
 * Removes every demo row and inserts the demo data again. Also used by the
 * nightly reset job, so demo agents' edits never last more than a day.
 */
export async function seedDemo(db: DB, opts: { log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const rand = mulberry32(20261006);

  await db.transaction(async (tx) => {
    // 1. Clear demo data. Listings, leads, terms and images cascade from users.
    const demoUsers = await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.isDemo, true));
    if (demoUsers.length) {
      await tx.delete(s.users).where(inArray(s.users.id, demoUsers.map((u) => u.id)));
    }
    await tx.delete(s.listings).where(eq(s.listings.isDemo, true));

    // 2. Areas (upsert, never deleted: real listings reference them).
    for (const a of AREAS) {
      await tx
        .insert(s.areas)
        .values({ name: a.name, slug: a.slug, centre: { x: a.x, y: a.y }, defaultZoom: a.zoom })
        .onConflictDoUpdate({ target: s.areas.slug, set: { name: a.name, centre: { x: a.x, y: a.y } } });
    }
    const areaRows = await tx.select().from(s.areas);
    const areaBySlug = Object.fromEntries(areaRows.map((a) => [a.slug, a]));

    // 3. Demo agents.
    const password = await hashPassword(DEMO_PASSWORD);
    const agentIds: string[] = [];
    for (const a of AGENTS) {
      const id = `demo_${slugify(a.name).replace(/-/g, "_")}`;
      agentIds.push(id);
      await tx.insert(s.users).values({ id, name: a.name, email: a.email, emailVerified: true, role: "agent", isDemo: true });
      await tx.insert(s.account).values({ id: nanoid(), accountId: id, providerId: "credential", userId: id, password });
      await tx.insert(s.agentProfiles).values({
        userId: id,
        slug: slugify(a.name),
        fullName: a.name,
        agencyName: a.agency,
        phone: a.wa,
        whatsapp: a.wa,
        bio: `${a.agency} lets and sells homes in ${a.areas.map((x) => areaBySlug[x]!.name).join(" and ")}. Sample profile for the Meridian demo.`,
        status: "verified",
        decidedAt: new Date(),
        approvedListingCount: 3,
        isDemo: true,
      });
    }

    // Two pending applications for the admin queue.
    for (const [i, name] of ["Chinedu Obi", "Funke Adeyemi"].entries()) {
      const id = `demo_applicant_${i + 1}`;
      await tx.insert(s.users).values({ id, name, email: `applicant${i + 1}@demo.meridian.ng`, emailVerified: true, role: "buyer", isDemo: true });
      await tx.insert(s.account).values({ id: nanoid(), accountId: id, providerId: "credential", userId: id, password });
      await tx.insert(s.agentProfiles).values({
        userId: id,
        slug: slugify(name),
        fullName: name,
        agencyName: i === 0 ? "Obi & Partners" : "Harbour Lettings",
        phone: `+23480100000${i + 1}0`,
        whatsapp: `+23480100000${i + 1}0`,
        cacNumber: i === 0 ? "RC 1234567" : null,
        status: "pending",
        isDemo: true,
      });
    }

    // A demo buyer, so favourites and saved searches can be tried.
    await tx.insert(s.users).values({ id: "demo_buyer", name: "Tolu Bello", email: "buyer@demo.meridian.ng", emailVerified: true, role: "buyer", isDemo: true });
    await tx.insert(s.account).values({ id: nanoid(), accountId: "demo_buyer", providerId: "credential", userId: "demo_buyer", password });

    // 4. Listings.
    const seeds = buildListings(rand);
    const now = Date.now();
    const usedSlugs = new Set<string>();
    for (const [i, l] of seeds.entries()) {
      const area = areaBySlug[l.area]!;
      const agentIndex = AGENTS.findIndex((a) => (a.areas as readonly string[]).includes(l.area));
      const agentId = agentIds[i < 10 && l.area === "lekki" ? 0 : (agentIndex + i) % 2 === 0 ? agentIndex : (agentIndex + 1) % AGENTS.length]!;
      // Exact pin within ~900 m of the area centre, then the stored public offset.
      const r = 900 * Math.sqrt(rand());
      const t = rand() * 2 * Math.PI;
      const ax = area.centre.x + (r * Math.sin(t)) / (111_320 * Math.cos((area.centre.y * Math.PI) / 180));
      const ay = area.centre.y + (r * Math.cos(t)) / 111_320;
      const pub = publicOffset(ax, ay, rand);
      const publishedAt = new Date(now - l.ageDays * 86_400_000 - Math.floor(rand() * 6) * 3_600_000);
      let slug = slugify(`${l.title} ${area.name}`);
      if (usedSlugs.has(slug)) slug = `${slug}-${i}`;
      usedSlugs.add(slug);
      const status = l.status ?? "active";
      const street = STREETS[l.area][i % 4]!;
      const amenities =
        l.amenities ?? AMENITY_POOL.filter(() => rand() < 0.45).slice(0, 7);

      const [row] = await tx
        .insert(s.listings)
        .values({
          agentId,
          areaId: area.id,
          slug,
          type: l.type,
          propertyType: l.propertyType,
          title: l.title,
          description:
            l.description ??
            `${l.title} in ${area.name}, close to ${street}. ${l.beds ? `${l.beds} bedroom${l.beds > 1 ? "s" : ""}, ${l.baths} bathroom${l.baths > 1 ? "s" : ""}. ` : ""}Sample listing for the Meridian demo; photos to follow.`,
          price: l.price,
          status,
          location: { x: ax, y: ay },
          publicLocation: pub,
          streetName: street,
          showStreet: i % 3 === 0,
          bedrooms: l.beds,
          bathrooms: l.baths,
          toilets: l.baths + (l.beds > 1 ? 1 : 0),
          parking: l.type === "sale" ? 2 : 1,
          sizeSqm: l.size,
          furnished: l.type === "shortlet",
          serviced: l.type === "shortlet" || l.title.includes("serviced"),
          amenities,
          isDemo: true,
          draftStep: 6,
          viewCount: Math.floor(rand() * 400),
          publishedAt: status === "pending" ? null : publishedAt,
          expiresAt: status === "pending" ? null : status === "expired" ? new Date(now - 10 * 86_400_000) : expiryFrom(publishedAt),
          createdAt: publishedAt,
        })
        .returning({ id: s.listings.id });
      const id = row!.id;

      if (l.type === "rent" && l.fees) {
        const [agencyFee, legalFee, cautionDeposit, serviceCharge] = l.fees;
        const f = { agencyFee, legalFee, cautionDeposit, serviceCharge };
        await tx.insert(s.listingRentTerms).values({ listingId: id, ...f, totalUpfront: totalUpfront(l.price, f) });
      } else if (l.type === "sale") {
        const docs = s.titleDocumentEnum.enumValues;
        await tx.insert(s.listingSaleTerms).values({ listingId: id, titleDocument: docs[i % 4]!, negotiable: i % 2 === 0 });
      } else if (l.type === "shortlet") {
        await tx.insert(s.listingShortletTerms).values({ listingId: id, minNights: 1 + (i % 3), cleaningFee: 15_000, cautionDeposit: 50_000 });
      }

      // A few leads on the demo agent's listings so the dashboard has content.
      if (agentId === agentIds[0] && status === "active") {
        const names = ["Kemi A.", "Emeka N.", "Bisi O.", "Segun F."];
        const n = Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const callback = rand() < 0.5;
          await tx.insert(s.leads).values({
            listingId: id,
            agentId,
            channel: callback ? "callback" : "whatsapp",
            name: callback ? names[(i + k) % 4] : null,
            phone: callback ? `+23480312345${i}${k}`.slice(0, 14) : null,
            message: callback ? "Afternoon is best. Is the price negotiable?" : null,
            status: (["new", "contacted", "viewing", "new"] as const)[(i + k) % 4],
            createdAt: new Date(now - Math.floor(rand() * 6 * 86_400_000)),
          });
        }
      }
    }
    // Make one listing of the demo agent expire within the week, for the "Still available" button.
    await tx.execute(sql`
      update listings set expires_at = now() + interval '3 days', published_at = now() - interval '27 days'
      where id = (select id from listings where agent_id = ${agentIds[0]} and status = 'active' order by created_at limit 1 offset 2)`);

    log(`Seeded ${AREAS.length} areas, ${AGENTS.length} demo agents and ${seeds.length} listings.`);
  });
}
