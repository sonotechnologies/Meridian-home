import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { agentProfiles, favourites, listings } from "@/db/schema";
import { FavouriteButton } from "@/components/favourite-button";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ListingCard } from "@/components/listing-card";
import { Avatar, SampleTag, VerifiedBadge } from "@/components/ui";
import { publicVisible, summariesWhere } from "@/server/search";
import { getUser } from "@/server/session";

type Props = { params: Promise<{ slug: string }> };

/** Only verified agents have a public profile. */
const getAgent = cache(async (slug: string) => {
  const [p] = await db
    .select()
    .from(agentProfiles)
    .where(and(eq(agentProfiles.slug, slug), eq(agentProfiles.status, "verified")))
    .limit(1);
  return p ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getAgent((await params).slug);
  if (!p) return { title: "Agent not found" };
  return {
    title: `${p.fullName}, ${p.agencyName}`,
    description: p.bio ?? `${p.fullName} of ${p.agencyName} is a verified agent on Meridian. See their homes on the map of Lagos.`,
  };
}

export default async function AgentPage({ params }: Props) {
  const p = await getAgent((await params).slug);
  if (!p) notFound();
  const [homes, user] = await Promise.all([summariesWhere(and(publicVisible(), eq(listings.agentId, p.userId))!, 60), getUser()]);
  const favs = new Set(
    user ? (await db.select({ id: favourites.listingId }).from(favourites).where(eq(favourites.userId, user.id))).map((f) => f.id) : [],
  );
  const since = p.decidedAt ?? p.createdAt;
  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-8 sm:py-12">
        <section className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-center">
          <Avatar name={p.fullName} src={p.photoUrl} size={96} />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps text-muted">{p.agencyName}</span>
              {p.isDemo ? <SampleTag /> : null}
            </div>
            <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">{p.fullName}</h1>
            <VerifiedBadge />
            <p className="m-0 text-sm text-muted">
              <span className="font-mono text-ink">{homes.length}</span> active {homes.length === 1 ? "listing" : "listings"} · verified since{" "}
              {since.toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "Africa/Lagos" })}
            </p>
          </div>
        </section>
        {p.bio ? <p className="m-0 max-w-[640px] whitespace-pre-line pt-6 text-base leading-6">{p.bio}</p> : null}
        <section className="flex flex-col gap-4 pt-8">
          <h2 className="m-0 font-display text-2xl font-semibold leading-8">Homes listed by {p.fullName.split(" ")[0]}</h2>
          {homes.length ? (
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {homes.map((l) => (
                <li key={l.id}>
                  <ListingCard l={l} fav={<FavouriteButton listingId={l.id} initial={favs.has(l.id)} />} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-muted">No homes on the map right now.</p>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
