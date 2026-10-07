import type { Metadata } from "next";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { agentProfiles, areas, listingImages, listingRentTerms, listings, reports } from "@/db/schema";
import { DecisionBar } from "@/components/admin/decision-bar";
import { DetailPane, EmptyDetail, TwoPane } from "@/components/admin/two-pane";
import { LocationMap } from "@/components/map/location-map";
import { chipClass, SampleTag, StatusBadge } from "@/components/ui";
import { naira, priceUnit, PROPERTY_LABEL, relativeDays, TYPE_TAG } from "@/lib/format";
import { imageUrl } from "@/lib/image-url";
import { APPROVALS_BEFORE_AUTOPUBLISH } from "@/lib/listing-rules";
import { approveListing, rejectListing, resolveReports } from "@/server/actions/admin";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Listing queue", robots: { index: false } };

const REASON_LABEL: Record<string, string> = {
  taken: "Already taken",
  fake: "Looks fake",
  "wrong-price": "Wrong price",
  "wrong-location": "Wrong location",
  other: "Something else",
};

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string }> }) {
  await requireRole("admin", "/admin/listings");
  const sp = await searchParams;
  const tab = sp.tab === "reported" ? "reported" : "queue";
  const base = `/admin/listings?tab=${tab}`;

  const reportCount = sql<number>`(select count(*)::int from ${reports} where ${reports.listingId} = ${listings.id} and not ${reports.resolved})`;
  const rows = await db
    .select({ id: listings.id, title: listings.title, created: listings.createdAt, area: areas.name, agency: agentProfiles.agencyName, reports: reportCount, hidden: listings.hiddenByReports })
    .from(listings)
    .leftJoin(areas, eq(areas.id, listings.areaId))
    .leftJoin(agentProfiles, eq(agentProfiles.userId, listings.agentId))
    .where(
      tab === "queue"
        ? and(eq(listings.status, "pending"), eq(listings.sandbox, false))
        : sql`exists (select 1 from ${reports} where ${reports.listingId} = ${listings.id} and not ${reports.resolved})`,
    )
    .orderBy(tab === "queue" ? asc(listings.updatedAt) : desc(listings.hiddenByReports))
    .limit(200);

  const selId = rows.find((r) => r.id === sp.id)?.id;
  const sel = selId
    ? (
        await db
          .select({
            l: listings,
            lng: sql<number>`ST_X(${listings.publicLocation})`,
            lat: sql<number>`ST_Y(${listings.publicLocation})`,
            area: areas.name,
            agent: agentProfiles,
            total: listingRentTerms.totalUpfront,
          })
          .from(listings)
          .leftJoin(areas, eq(areas.id, listings.areaId))
          .leftJoin(agentProfiles, eq(agentProfiles.userId, listings.agentId))
          .leftJoin(listingRentTerms, eq(listingRentTerms.listingId, listings.id))
          .where(eq(listings.id, selId))
      )[0]
    : undefined;
  const [images, reportRows] = sel
    ? await Promise.all([
        db.select({ url: listingImages.url }).from(listingImages).where(eq(listingImages.listingId, sel.l.id)).orderBy(asc(listingImages.position)),
        db.select().from(reports).where(and(eq(reports.listingId, sel.l.id), eq(reports.resolved, false))).orderBy(desc(reports.createdAt)),
      ])
    : [[], []];

  return (
    <TwoPane
      title="Listings"
      tabs={
        <nav aria-label="Queue" className="flex gap-2">
          <Link href="/admin/listings?tab=queue" aria-current={tab === "queue" ? "page" : undefined} className={chipClass(tab === "queue") + " no-underline"}>
            Approval queue
          </Link>
          <Link href="/admin/listings?tab=reported" aria-current={tab === "reported" ? "page" : undefined} className={chipClass(tab === "reported") + " no-underline"}>
            Reported
          </Link>
        </nav>
      }
      items={rows.map((r) => ({
        id: r.id,
        href: `${base}&id=${r.id}`,
        title: r.title || "Untitled",
        meta: tab === "queue" ? `${r.agency ?? "—"} · ${r.area ?? "—"} · ${relativeDays(r.created)}` : `${r.reports} ${r.reports === 1 ? "report" : "reports"}${r.hidden ? " · hidden" : ""}`,
        badge: tab === "reported" && r.hidden ? <StatusBadge status="pending" label="Hidden" /> : undefined,
      }))}
      selectedId={sel?.l.id}
      empty={tab === "queue" ? "Nothing waiting for review." : "No open reports."}
      detail={
        sel ? (
          <DetailPane
            back={base}
            actions={
              tab === "queue" ? (
                <DecisionBar
                  next={base}
                  actions={[
                    {
                      label: "Reject",
                      variant: "danger",
                      run: rejectListing.bind(null, sel.l.id),
                      needsReason: { title: "Reject this listing", hint: "We email this to the agent. Say what to change, e.g. “Photos have watermarks.”" },
                      done: "Rejected. The agent has the reason.",
                    },
                    { label: "Approve", variant: "secondary", run: approveListing.bind(null, sel.l.id), done: "Approved. It’s on the map for 30 days." },
                  ]}
                />
              ) : (
                <DecisionBar
                  next={base}
                  actions={[
                    {
                      label: "Confirm fake",
                      variant: "danger",
                      run: resolveReports.bind(null, sel.l.id, "fake"),
                      needsReason: { title: "Confirm this listing is fake", hint: "The listing comes down and the agent is suspended." },
                      done: "Taken down; agent suspended.",
                    },
                    {
                      label: "Take down",
                      variant: "tertiary",
                      run: resolveReports.bind(null, sel.l.id, "takedown"),
                      needsReason: { title: "Take this listing down", hint: "The agent sees this reason in their dashboard." },
                      done: "Listing taken down.",
                    },
                    { label: "Dismiss reports", variant: "secondary", run: resolveReports.bind(null, sel.l.id, "dismiss"), done: "Reports dismissed. It’s back on the map." },
                  ]}
                />
              )
            }
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-caps text-muted">
                  {TYPE_TAG[sel.l.type]} · {PROPERTY_LABEL[sel.l.propertyType]} · {sel.area}
                </span>
                {sel.l.isDemo ? <SampleTag /> : null}
              </div>
              <h2 className="m-0 font-display text-[28px] font-semibold leading-[34px]">{sel.l.title}</h2>
              <p className="m-0 text-[15px]">
                <span className="font-mono text-lg">{naira(sel.l.price)}</span> <span className="text-muted">{priceUnit(sel.l.type)}</span>
                {sel.total ? (
                  <span className="text-muted">
                    {" "}
                    · Total to move in <span className="font-mono text-ink">{naira(sel.total)}</span>
                  </span>
                ) : null}
              </p>
            </div>
            {images.length ? (
              <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
                {images.map((i, n) => (
                  <li key={i.url}>
                    <a href={i.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(i.url, 320, 240)} alt={`Photo ${n + 1}`} className="aspect-[4/3] w-full rounded-[6px] object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-muted">No photos (sample listing).</p>
            )}
            {reportRows.length ? (
              <section className="flex flex-col gap-2">
                <h3 className="m-0 text-lg font-semibold">Reports</h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {reportRows.map((r) => (
                    <li key={r.id} className="rounded-[6px] border border-line bg-surface px-3 py-2 text-[15px]">
                      <span className="font-semibold">{REASON_LABEL[r.reason]}</span> <span className="text-sm text-muted">· {relativeDays(r.createdAt)}</span>
                      {r.note ? <p className="m-0 mt-1 text-sm">{r.note}</p> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-lg font-semibold">Agent</h3>
              <p className="m-0 text-[15px]">
                {sel.agent?.fullName} · {sel.agent?.agencyName} ·{" "}
                <span className="text-muted">
                  <span className="font-mono">{sel.agent?.approvedListingCount ?? 0}</span> of {APPROVALS_BEFORE_AUTOPUBLISH} approvals before listings publish straight away
                </span>
              </p>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-lg font-semibold">Description</h3>
              <p className="m-0 whitespace-pre-line text-[15px]">{sel.l.description}</p>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-lg font-semibold">Location</h3>
              <div className="relative h-[220px] overflow-hidden rounded-[10px] border border-line">
                <LocationMap lng={Number(sel.lng)} lat={Number(sel.lat)} label={sel.area ?? "Lagos"} />
              </div>
            </section>
          </DetailPane>
        ) : (
          <EmptyDetail text="Pick a listing from the queue." />
        )
      }
    />
  );
}

