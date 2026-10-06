import type { Metadata } from "next";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { favourites, listings } from "@/db/schema";
import { FavouriteButton } from "@/components/favourite-button";
import { Header } from "@/components/header";
import { ListingCard } from "@/components/listing-card";
import { ButtonLink, StatusBadge } from "@/components/ui";
import { summariesWhere } from "@/server/search";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Saved homes", robots: { index: false } };

export default async function SavedPage() {
  const user = await requireRole(["buyer", "agent", "admin"], "/saved");
  const favs = await db
    .select({ id: favourites.listingId, status: listings.status, expiresAt: listings.expiresAt })
    .from(favourites)
    .innerJoin(listings, eq(listings.id, favourites.listingId))
    .where(and(eq(favourites.userId, user.id), eq(listings.sandbox, false)))
    .orderBy(desc(favourites.createdAt));
  const cards = favs.length ? await summariesWhere(inArray(listings.id, favs.map((f) => f.id)), 200) : [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const gone = (f: (typeof favs)[number]) => f.status !== "active" || (f.expiresAt && f.expiresAt < new Date());

  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8">
        <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">Saved homes</h1>
        {favs.length === 0 ? (
          <div className="contour-bg mt-6 flex flex-col items-center gap-4 rounded-[10px] border border-line px-6 py-14 text-center">
            <p className="m-0 rounded-[6px] bg-paper/90 px-3 py-1 text-[17px]">Tap the heart on any home to save it here.</p>
            <ButtonLink href="/search" variant="secondary">
              Search the map
            </ButtonLink>
          </div>
        ) : (
          <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {favs.map((f) => {
              const c = byId.get(f.id);
              if (!c) return null;
              return (
                <li key={f.id} className={gone(f) ? "relative opacity-70 grayscale" : undefined}>
                  <ListingCard l={c} fav={<FavouriteButton listingId={c.id} initial />} />
                  {gone(f) ? (
                    <span className="absolute bottom-3 right-3">
                      <StatusBadge status="expired" label="No longer available" />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
