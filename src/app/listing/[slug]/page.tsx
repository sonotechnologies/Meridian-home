import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db";
import { favourites } from "@/db/schema";
import { FavouriteButton } from "@/components/favourite-button";
import { Header } from "@/components/header";
import { Icon, type IconName } from "@/components/icon";
import { ContactButtons, type ContactListing } from "@/components/listing/contact";
import { Gallery } from "@/components/listing/gallery";
import { ReportLink, ViewedMarker } from "@/components/listing/report";
import { ListingCard } from "@/components/listing-card";
import { LocationMap } from "@/components/map/location-map";
import { Avatar, Card, SampleTag, StatusBadge, VerifiedBadge } from "@/components/ui";
import { filtersToParams } from "@/lib/filters";
import { naira, priceUnit, PROPERTY_LABEL, relativeDays, TITLE_DOCUMENTS, TYPE_LABEL } from "@/lib/format";
import { FEE_LABELS, feeLabel, type RentFees } from "@/lib/listing-rules";
import { getListingBySlug, listingVisibility, recordView, similarListings, type ListingDetail } from "@/server/listing";
import { getUser } from "@/server/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const l = await getListingBySlug(slug);
  if (!l || listingVisibility(l, null) === "hidden") return { title: "Listing not found" };
  const unit = priceUnit(l.type);
  const price = `${naira(l.price)}${unit ? " " + unit : ""}`;
  const total = l.type === "rent" && l.rent?.totalUpfront ? ` Total to move in: ${naira(l.rent.totalUpfront)}.` : "";
  const description = `${l.title} in ${l.areaName}, ${price}.${total} ${l.bedrooms ? `${l.bedrooms} bedrooms, ${l.bathrooms} bathrooms. ` : ""}WhatsApp the agent on Meridian.`;
  return {
    title: `${l.title}, ${l.areaName}`,
    description,
    openGraph: { title: `${l.title}, ${l.areaName} · ${price}`, description, type: "article" },
    robots: listingVisibility(l, null) === "public" ? undefined : { index: false },
  };
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp/i;

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const [l, user] = await Promise.all([getListingBySlug(slug), getUser()]);
  if (!l) notFound();
  const vis = listingVisibility(l, user);
  if (vis === "hidden") notFound();

  const [favRow, similar] = await Promise.all([
    user ? db.select().from(favourites).where(and(eq(favourites.userId, user.id), eq(favourites.listingId, l.id))).limit(1) : [],
    vis === "gone" ? similarListings(l, 4) : Promise.resolve([]),
  ]);
  const isFav = favRow.length > 0;

  if (vis === "public") {
    const ua = (await headers()).get("user-agent") ?? "";
    if (!BOT.test(ua) && user?.id !== l.agentId) after(() => recordView(l.id));
  }

  const backParams = filtersToParams({ type: l.type, area: l.areaSlug ?? undefined });
  const backHref = `/search${backParams.size ? `?${backParams}` : ""}`;
  const contact: ContactListing = {
    slug: l.slug,
    title: l.title,
    areaName: l.areaName,
    price: l.price,
    type: l.type,
    agentName: l.agent?.name ?? "the agent",
    isDemo: l.isDemo,
  };
  const live = vis === "public";

  return (
    <>
      <Header back={{ href: backHref, label: "Back to map" }} />
      {live ? <ViewedMarker id={l.id} /> : null}
      <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:pb-24">
        {vis === "gone" ? (
          <div role="status" className="mb-4 flex items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-3">
            <Icon n="alert" />
            <div>
              <p className="m-0 font-semibold">This listing is no longer available</p>
              <p className="m-0 text-sm text-muted">It was let, sold or taken down by the agent. Similar homes are below.</p>
            </div>
          </div>
        ) : null}
        {vis === "preview" ? (
          <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-amber-tint bg-[#FBF3DD] px-4 py-3">
            <StatusBadge status={l.hiddenByReports ? "pending" : (l.status as "draft" | "pending" | "rejected")} label={l.hiddenByReports ? "Hidden after reports" : undefined} />
            <p className="m-0 text-sm">Only you can see this page. Buyers will see it once the listing is active.</p>
          </div>
        ) : null}

        <Gallery images={l.images} title={l.title} greyed={vis === "gone"} />

        <div className="flex flex-wrap items-start gap-8 pt-6 lg:gap-12 lg:pt-8">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-caps text-muted">
                  {TYPE_LABEL[l.type]} · {PROPERTY_LABEL[l.propertyType]} · {l.areaName}
                </span>
                {l.isDemo ? <SampleTag /> : null}
              </div>
              <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] [text-wrap:balance] sm:text-4xl sm:leading-[44px]">{l.title}</h1>
              {l.publishedAt ? (
                <span className="text-[15px] text-muted">
                  {vis === "gone" ? "Last confirmed available" : "Confirmed available"} {relativeDays(l.publishedAt)}
                </span>
              ) : null}
            </div>

            {/* Price block inline on mobile; the sticky column holds it on desktop. */}
            <div className="flex flex-col gap-1 lg:hidden">
              <PriceBlock l={l} />
            </div>

            <Specs l={l} />

            {l.type === "rent" && l.rent?.totalUpfront ? <CostBreakdown rent={l.price} fees={l.rent} total={l.rent.totalUpfront} /> : null}
            {l.type === "sale" && l.sale?.titleDocument ? <SaleTerms l={l} /> : null}
            {l.type === "shortlet" && l.shortlet?.minNights ? <ShortletTerms l={l} /> : null}

            <section className="flex flex-col gap-2.5">
              <h2 className="m-0 font-display text-2xl font-semibold leading-8">About this home</h2>
              <p className="m-0 max-w-[640px] whitespace-pre-line text-base leading-6">{l.description}</p>
            </section>

            {l.amenities.length ? (
              <section className="flex flex-col gap-3">
                <h3 className="m-0 text-lg font-semibold leading-[26px]">Amenities</h3>
                <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-2.5 p-0 sm:grid-cols-2">
                  {l.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2.5 text-[15px]">
                      <span className="text-green">
                        <Icon n="check" size={16} stroke={2} />
                      </span>
                      {a}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="flex flex-col gap-2.5">
              <h3 className="m-0 text-lg font-semibold leading-[26px]">Location</h3>
              <p className="m-0 text-[15px]">
                {l.showStreet && l.streetName ? `${l.streetName}, ` : ""}
                {l.areaName}
              </p>
              <div className="relative h-[260px] overflow-hidden rounded-[10px] border border-line">
                <LocationMap lng={l.lng} lat={l.lat} label={l.areaName ?? "Lagos"} />
              </div>
              <span className="text-sm text-muted">Approximate location. The agent shares the exact address when you book a viewing.</span>
            </section>

            <div className="lg:hidden">
              <AgentCard l={l} />
            </div>

            <div>
              <ReportLink slug={l.slug} />
            </div>
          </div>

          {/* Desktop: sticky right column with price, agent card and contact buttons. */}
          <aside className="sticky top-[88px] hidden flex-[0_1_340px] flex-col gap-3.5 rounded-[10px] border border-line bg-surface p-6 lg:flex" aria-label="Price and agent">
            <PriceBlock l={l} />
            <div className="h-px bg-line" />
            <AgentCard l={l} bare />
            {live ? (
              <>
                <ContactButtons l={contact} layout="stack" />
                <FavouriteButton listingId={l.id} initial={isFav} variant="text" />
              </>
            ) : null}
          </aside>
        </div>

        {vis === "gone" && similar.length ? (
          <section className="mt-12 flex flex-col gap-4">
            <h2 className="m-0 font-display text-2xl font-semibold">Similar homes in {l.areaName}</h2>
            <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((s) => (
                <li key={s.id}>
                  <ListingCard l={s} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {/* Mobile: sticky bottom bar with WhatsApp in signal and a call-back button. */}
      {live ? (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
          <FavouriteButton listingId={l.id} initial={isFav} />
          <div className="flex-1">
            <ContactButtons l={contact} layout="bar" />
          </div>
        </div>
      ) : null}
    </>
  );
}

function PriceBlock({ l }: { l: ListingDetail }) {
  const unit = priceUnit(l.type);
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[28px] font-medium leading-8">{naira(l.price)}</span>
        {unit ? <span className="text-base text-muted">{unit}</span> : null}
      </div>
      {l.type === "rent" && l.rent?.totalUpfront ? (
        <span className="text-sm text-muted">
          Total to move in <span className="font-mono text-ink">{naira(l.rent.totalUpfront)}</span>
        </span>
      ) : null}
      {l.type === "sale" && l.sale?.negotiable ? <span className="text-sm text-muted">Price is negotiable</span> : null}
    </>
  );
}

function Specs({ l }: { l: ListingDetail }) {
  const items: [IconName, React.ReactNode][] = [];
  if (l.bedrooms) items.push(["bed", `${l.bedrooms} ${l.bedrooms === 1 ? "bedroom" : "bedrooms"}`]);
  if (l.bathrooms) items.push(["bath", `${l.bathrooms} ${l.bathrooms === 1 ? "bathroom" : "bathrooms"}`]);
  if (l.parking) items.push(["car", `${l.parking} parking`]);
  if (l.sizeSqm) items.push(["size", <span key="s" className="font-mono">{l.sizeSqm} m²</span>]);
  const extras = [l.furnished && "Furnished", l.serviced && "Serviced", l.toilets ? `${l.toilets} toilets` : null].filter(Boolean);
  return (
    <div className="flex flex-col gap-2 border-y border-line py-4">
      <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-3 p-0 text-[15px]">
        {items.map(([icon, label], i) => (
          <li key={i} className="flex items-center gap-2">
            <Icon n={icon} />
            {label}
          </li>
        ))}
      </ul>
      {extras.length ? <p className="m-0 text-sm text-muted">{extras.join(" · ")}</p> : null}
    </div>
  );
}

/** The headline feature: every fee on its own line in mono, a rule, then the total in the large price style. */
function CostBreakdown({ rent, fees, total }: { rent: number; fees: RentFees & { totalUpfront: number }; total: number }) {
  const rows = FEE_LABELS.map(([key, base]) => {
    const amount = key === "rent" ? rent : fees[key];
    return { label: key === "rent" ? base : feeLabel(key, base, amount, rent), amount };
  }).filter((r) => r.amount > 0);
  return (
    <Card className="flex flex-col gap-3.5 p-5 sm:p-7">
      <h2 className="m-0 font-display text-2xl font-semibold leading-8">What it costs to move in</h2>
      <dl className="m-0 flex flex-col">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 border-b border-dashed border-line py-2.5 text-base">
            <dt>{r.label}</dt>
            <dd className="m-0 font-mono font-medium">{naira(r.amount)}</dd>
          </div>
        ))}
      </dl>
      <div className="h-0.5 bg-ink" />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-lg font-semibold">Total to move in</span>
        <span className="font-mono text-[28px] font-medium leading-8">{naira(total)}</span>
      </div>
    </Card>
  );
}

function TermsCard({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <Card className="flex flex-col gap-3 p-5 sm:p-7">
      <h2 className="m-0 font-display text-2xl font-semibold leading-8">{title}</h2>
      <dl className="m-0 flex flex-col">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 border-b border-dashed border-line py-2.5 text-base last:border-0">
            <dt>{k}</dt>
            <dd className="m-0 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SaleTerms({ l }: { l: ListingDetail }) {
  const doc = TITLE_DOCUMENTS.find(([v]) => v === l.sale!.titleDocument)?.[1] ?? "Other";
  return (
    <TermsCard
      title="Title and price"
      rows={[
        ["Title document", doc],
        ["Price", <span key="p" className="font-mono">{naira(l.price)}</span>],
        ["Negotiable", l.sale!.negotiable ? "Yes" : "No"],
      ]}
    />
  );
}

function ShortletTerms({ l }: { l: ListingDetail }) {
  const s = l.shortlet!;
  return (
    <TermsCard
      title="Before you book"
      rows={[
        ["Nightly rate", <span key="r" className="font-mono">{naira(l.price)}</span>],
        ["Minimum stay", `${s.minNights} ${s.minNights === 1 ? "night" : "nights"}`],
        ["Cleaning fee", <span key="c" className="font-mono">{naira(s.cleaningFee ?? 0)}</span>],
        ["Caution deposit (refundable)", <span key="d" className="font-mono">{naira(s.cautionDeposit ?? 0)}</span>],
      ]}
    />
  );
}

function AgentCard({ l, bare }: { l: ListingDetail; bare?: boolean }) {
  if (!l.agent?.name) return null;
  const body = (
    <div className="flex flex-col gap-3">
      <Link href={`/agents/${l.agent.slug}`} className="flex items-center gap-3 !text-ink no-underline">
        <Avatar name={l.agent.name} src={l.agent.photoUrl} size={48} />
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{l.agent.name}</span>
          <span className="text-[13px] text-muted">
            {l.agent.agency} · <span className="font-mono">{l.agentListingCount}</span> {l.agentListingCount === 1 ? "listing" : "listings"}
          </span>
        </span>
      </Link>
      {l.agent.status === "verified" ? <VerifiedBadge /> : null}
    </div>
  );
  if (bare) return body;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-semibold">Listed by</h3>
      <Card className="p-5">{body}</Card>
    </section>
  );
}

