import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { agentProfiles, listings, users } from "@/db/schema";
import { DecisionBar } from "@/components/admin/decision-bar";
import { DetailPane, EmptyDetail, TwoPane } from "@/components/admin/two-pane";
import { Avatar, chipClass, StatusBadge, VerifiedBadge } from "@/components/ui";
import { relativeDays } from "@/lib/format";
import { approveAgent, rejectAgent, suspendAgent } from "@/server/actions/admin";
import { privateDocumentUrl } from "@/server/images";
import { requireRole } from "@/server/session";
import { sql } from "drizzle-orm";

export const metadata: Metadata = { title: "Agent applications", robots: { index: false } };

const TABS = [
  ["pending", "Pending"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
  ["suspended", "Suspended"],
] as const;
type Tab = (typeof TABS)[number][0];

export default async function AdminAgents({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string }> }) {
  await requireRole("admin", "/admin/agents");
  const sp = await searchParams;
  const tab: Tab = (TABS.find(([t]) => t === sp.tab)?.[0] ?? "pending") as Tab;
  const rows = await db
    .select({ p: agentProfiles, email: users.email, joined: users.createdAt })
    .from(agentProfiles)
    .innerJoin(users, eq(users.id, agentProfiles.userId))
    .where(eq(agentProfiles.status, tab))
    .orderBy(tab === "pending" ? agentProfiles.createdAt : desc(agentProfiles.updatedAt))
    .limit(200);
  const sel = rows.find((r) => r.p.userId === sp.id);
  const base = `/admin/agents?tab=${tab}`;
  const [{ n: liveListings }] = sel
    ? await db.select({ n: sql<number>`count(*)::int` }).from(listings).where(eq(listings.agentId, sel.p.userId))
    : [{ n: 0 }];

  const docUrl = sel?.p.idDocumentUrl ? privateDocumentUrl(sel.p.idDocumentUrl) : null;
  const isPdf = sel?.p.idDocumentUrl?.endsWith(".pdf");

  return (
    <TwoPane
      title="Agents"
      tabs={
        <nav aria-label="Application status" className="flex flex-wrap gap-2">
          {TABS.map(([t, label]) => (
            <Link key={t} href={`/admin/agents?tab=${t}`} aria-current={t === tab ? "page" : undefined} className={chipClass(t === tab) + " no-underline"}>
              {label}
            </Link>
          ))}
        </nav>
      }
      items={rows.map((r) => ({
        id: r.p.userId,
        href: `${base}&id=${r.p.userId}`,
        title: r.p.fullName,
        meta: `${r.p.agencyName} · applied ${relativeDays(r.p.createdAt)}`,
      }))}
      selectedId={sel?.p.userId}
      empty={tab === "pending" ? "No applications waiting. Nice." : "Nobody here."}
      detail={
        sel ? (
          <DetailPane
            back={base}
            actions={
              sel.p.status === "pending" ? (
                <DecisionBar
                  next={base}
                  actions={[
                    {
                      label: "Reject",
                      variant: "danger",
                      run: rejectAgent.bind(null, sel.p.userId),
                      needsReason: { title: `Reject ${sel.p.fullName}`, hint: "We email this to the applicant, so say what to fix, e.g. “The ID photo is blurred; upload a clearer one.”" },
                      done: "Rejected. We’ve emailed the reason.",
                    },
                    { label: "Approve", variant: "secondary", run: approveAgent.bind(null, sel.p.userId), done: "Approved. They’re now a verified agent." },
                  ]}
                />
              ) : sel.p.status === "verified" ? (
                <DecisionBar
                  next={base}
                  actions={[
                    {
                      label: "Suspend",
                      variant: "danger",
                      run: suspendAgent.bind(null, sel.p.userId),
                      needsReason: { title: `Suspend ${sel.p.fullName}`, hint: "Their listings come off the map and they’re signed out." },
                      done: "Suspended.",
                    },
                  ]}
                />
              ) : null
            }
          >
            <div className="flex items-center gap-4">
              <Avatar name={sel.p.fullName} src={sel.p.photoUrl} size={64} />
              <div className="flex flex-col gap-1">
                <h2 className="m-0 font-display text-2xl font-semibold">{sel.p.fullName}</h2>
                {sel.p.status === "verified" ? <VerifiedBadge /> : <StatusBadge status={sel.p.status === "suspended" ? "rejected" : (sel.p.status as "pending" | "rejected")} label={sel.p.status === "suspended" ? "Suspended" : undefined} />}
              </div>
            </div>
            <dl className="m-0 grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-[15px]">
              <dt className="text-muted">Agency</dt>
              <dd className="m-0">{sel.p.agencyName}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="m-0">{sel.email}</dd>
              <dt className="text-muted">Phone</dt>
              <dd className="m-0 font-mono">{sel.p.phone}</dd>
              <dt className="text-muted">WhatsApp</dt>
              <dd className="m-0 font-mono">{sel.p.whatsapp}</dd>
              <dt className="text-muted">CAC number</dt>
              <dd className="m-0 font-mono">{sel.p.cacNumber ?? "Not given"}</dd>
              <dt className="text-muted">Account since</dt>
              <dd className="m-0">{sel.joined.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" })}</dd>
              <dt className="text-muted">Listings</dt>
              <dd className="m-0 font-mono">{liveListings}</dd>
              {sel.p.rejectionReason ? (
                <>
                  <dt className="text-muted">Reason given</dt>
                  <dd className="m-0">{sel.p.rejectionReason}</dd>
                </>
              ) : null}
            </dl>
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-lg font-semibold">Government ID</h3>
              {docUrl ? (
                isPdf ? (
                  <a href={docUrl} target="_blank" rel="noreferrer" className="text-[15px] font-semibold">
                    Open the ID (PDF)
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={docUrl} alt={`Government ID uploaded by ${sel.p.fullName}`} className="max-h-[420px] w-full rounded-[10px] border border-line bg-surface object-contain" />
                )
              ) : (
                <p className="m-0 text-[15px] text-muted">
                  {sel.p.decidedAt ? "Deleted 30 days after the decision, as promised to applicants." : "No ID uploaded (sample application)."}
                </p>
              )}
              <p className="m-0 text-[13px] text-muted">Only admins can open this. It’s deleted 30 days after you decide.</p>
            </section>
          </DetailPane>
        ) : (
          <EmptyDetail text="Pick an application from the queue." />
        )
      }
    />
  );
}
