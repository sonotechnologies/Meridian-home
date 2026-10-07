import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, listings } from "@/db/schema";
import { AreaEditor } from "@/components/admin/area-editor";
import { publicVisible } from "@/server/search";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Areas", robots: { index: false } };

export default async function AdminAreas() {
  await requireRole("admin", "/admin/areas");
  const rows = await db
    .select({
      id: areas.id,
      name: areas.name,
      slug: areas.slug,
      lng: sql<number>`ST_X(${areas.centre})`,
      lat: sql<number>`ST_Y(${areas.centre})`,
      zoom: areas.defaultZoom,
      isActive: areas.isActive,
      count: sql<number>`(select count(*)::int from ${listings} where ${listings.areaId} = "areas"."id" and ${publicVisible()})`,
    })
    .from(areas)
    .orderBy(asc(areas.id));
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">Areas</h1>
        <p className="m-0 text-[15px] text-muted">The areas agents can list in. The centre is where the map opens when a buyer picks the area.</p>
      </div>
      <AreaEditor areas={rows.map((r) => ({ ...r, lng: Number(r.lng), lat: Number(r.lat) }))} />
    </div>
  );
}
