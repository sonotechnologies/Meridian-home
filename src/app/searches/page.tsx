import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedSearches } from "@/db/schema";
import { Header } from "@/components/header";
import { SavedSearches } from "@/components/saved-searches";
import { ButtonLink } from "@/components/ui";
import { relativeDays } from "@/lib/format";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Saved searches", robots: { index: false } };

export default async function SearchesPage() {
  const user = await requireRole(["buyer", "agent", "admin"], "/searches");
  const rows = await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt));
  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-[860px] px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">Saved searches</h1>
          <p className="m-0 text-[15px] text-muted">We email you new homes that match each search, once a morning. Every email has a link to stop it.</p>
        </div>
        <div className="mt-6">
          {rows.length ? (
            <SavedSearches
              rows={rows.map((s) => {
                const q = new URLSearchParams(s.filters);
                if (s.bounds) {
                  const lat = (s.bounds.north + s.bounds.south) / 2;
                  const lng = (s.bounds.east + s.bounds.west) / 2;
                  const zoom = Math.log2(360 / Math.max(0.0001, s.bounds.east - s.bounds.west)) + 1.5;
                  q.set("at", `${lat.toFixed(5)},${lng.toFixed(5)},${Math.min(17, zoom).toFixed(2)}`);
                }
                return { id: s.id, name: s.name, href: `/search?${q}`, alertsOn: s.alertsOn, hasBounds: Boolean(s.bounds), created: relativeDays(s.createdAt) };
              })}
            />
          ) : (
            <div className="contour-bg flex flex-col items-center gap-4 rounded-[10px] border border-line px-6 py-14 text-center">
              <p className="m-0 rounded-[6px] bg-paper/90 px-3 py-1 text-[17px]">Filter the map, then tap “Save search” to get new matches by email.</p>
              <ButtonLink href="/search" variant="secondary">
                Search the map
              </ButtonLink>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
