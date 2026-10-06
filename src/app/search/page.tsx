import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { favourites } from "@/db/schema";
import { Header } from "@/components/header";
import { SearchView } from "@/components/search/search-view";
import { atSchema, describeFilters, parseFilters, type BBox } from "@/lib/filters";
import { getAreas, searchListings } from "@/server/search";
import { getUser } from "@/server/session";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const areas = await getAreas();
  const area = areas.find((a) => a.slug === f.area)?.name;
  const title = `${describeFilters(f, area ?? "Lagos")}`;
  return { title, description: `${title}. Filter a live map, see the total cost to move in, and WhatsApp the agent.` };
}

/** Rough bounds for an "at" position, so the first render matches what the map will show. */
function approxBounds(lat: number, lng: number, zoom: number): BBox {
  const degPerPx = 360 / (256 * 2 ** zoom);
  const halfW = 450 * degPerPx;
  const halfH = 400 * degPerPx;
  return [lng - halfW, lat - halfH, lng + halfW, lat + halfH];
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const at = typeof sp.at === "string" ? atSchema.safeParse(sp.at) : null;
  const [areas, user] = await Promise.all([getAreas(), getUser()]);
  const area = areas.find((a) => a.slug === f.area);

  const initialView = at?.success
    ? { lat: at.data[0], lng: at.data[1], zoom: at.data[2] }
    : area
      ? { lat: area.lat, lng: area.lng, zoom: area.zoom }
      : undefined;
  const bbox = at?.success ? approxBounds(at.data[0], at.data[1], at.data[2]) : undefined;

  const [result, favRows] = await Promise.all([
    searchListings(f, bbox),
    user ? db.select({ id: favourites.listingId }).from(favourites).where(eq(favourites.userId, user.id)) : [],
  ]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        <SearchView
          initialFilters={f}
          initialResult={result}
          initialView={initialView}
          areas={areas}
          favouriteIds={favRows.map((r) => r.id)}
        />
      </main>
    </div>
  );
}
