import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { seedDemo } from "@/db/seed-data";
import { db } from "@/db";
import { listings } from "@/db/schema";
import { parseFilters } from "@/lib/filters";
import { getAreas, searchListings } from "../search";

// Each file starts from fresh demo data, so tests don't depend on run order.
beforeAll(() => seedDemo(db));

const LAGOS: [number, number, number, number] = [3.2, 6.35, 3.65, 6.7];

describe("searchListings", () => {
  it("returns only active rent listings by default, newest first", async () => {
    const r = await searchListings(parseFilters({}), LAGOS);
    expect(r.total).toBe(24);
    expect(r.pins).toHaveLength(24);
    expect(r.items).toHaveLength(20);
    expect(r.pins.every((p) => p.type === "rent")).toBe(true);
    const dates = r.pins.map((p) => p.publishedAt!);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("never exposes the exact location", async () => {
    const r = await searchListings(parseFilters({ type: "sale" }), LAGOS);
    for (const p of r.pins) expect(Object.keys(p)).not.toContain("location");
    const [exact] = await db
      .select({ x: sql<number>`ST_X(${listings.location})`, y: sql<number>`ST_Y(${listings.location})` })
      .from(listings)
      .where(eq(listings.id, r.pins[0]!.id));
    expect(Number(exact!.x)).not.toBe(r.pins[0]!.lng);
  });

  it("filters by bounds", async () => {
    const yaba = (await getAreas()).find((a) => a.slug === "yaba")!;
    const d = 0.02;
    const r = await searchListings(parseFilters({}), [yaba.lng - d, yaba.lat - d, yaba.lng + d, yaba.lat + d]);
    expect(r.total).toBeGreaterThan(0);
    expect(r.pins.every((p) => p.area === "Yaba")).toBe(true);
  });

  it("filters rent by total upfront instead of rent", async () => {
    const byRent = await searchListings(parseFilters({ max: "4500000" }), LAGOS);
    const byTotal = await searchListings(parseFilters({ max: "4500000", basis: "total" }), LAGOS);
    expect(byTotal.total).toBeLessThan(byRent.total);
    expect(byTotal.pins.every((p) => p.totalUpfront! <= 4_500_000)).toBe(true);
  });

  it("filters by bedrooms, property type and area, and sorts by price", async () => {
    const r = await searchListings(parseFilters({ beds: "3", sort: "price-asc" }), LAGOS);
    expect(r.pins.every((p) => p.beds >= 3)).toBe(true);
    const prices = r.pins.map((p) => p.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    const sc = await searchListings(parseFilters({ ptype: "self-contain" }), LAGOS);
    expect(sc.pins.every((p) => p.propertyType === "self-contain")).toBe(true);
    const ikoyi = await searchListings(parseFilters({ area: "ikoyi" }));
    expect(ikoyi.pins.every((p) => p.area === "Ikoyi")).toBe(true);
  });

  it("hides sandbox, reported and expired listings", async () => {
    const before = await searchListings(parseFilters({}), LAGOS);
    const id = before.pins[0]!.id;
    await db.update(listings).set({ sandbox: true }).where(eq(listings.id, id));
    expect((await searchListings(parseFilters({}), LAGOS)).pins.find((p) => p.id === id)).toBeUndefined();
    await db.update(listings).set({ sandbox: false, hiddenByReports: true }).where(eq(listings.id, id));
    expect((await searchListings(parseFilters({}), LAGOS)).pins.find((p) => p.id === id)).toBeUndefined();
    await db.update(listings).set({ hiddenByReports: false, expiresAt: new Date(Date.now() - 1000) }).where(eq(listings.id, id));
    expect((await searchListings(parseFilters({}), LAGOS)).pins.find((p) => p.id === id)).toBeUndefined();
    await db.update(listings).set({ expiresAt: new Date(Date.now() + 86_400_000) }).where(eq(listings.id, id));
  });

  it("paginates the list at 20", async () => {
    const p2 = await searchListings(parseFilters({ page: "2" }), LAGOS);
    expect(p2.items).toHaveLength(4);
  });

  it("ignores junk in the URL", () => {
    const f = parseFilters({ type: "castle", beds: "lots", sort: "?", min: "-5", ptype: "igloo" });
    expect(f).toMatchObject({ type: "rent", sort: "newest", page: 1 });
    expect(f.beds).toBeUndefined();
    expect(f.min).toBeUndefined();
    expect(f.ptype).toBeUndefined();
  });
});
