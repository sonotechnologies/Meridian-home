import type { Metadata } from "next";
import Link from "next/link";
import { EmptyListings, ListingsTable } from "@/components/dashboard/listings-table";
import { Icon, type IconName } from "@/components/icon";
import { ButtonLink } from "@/components/ui";
import { agentListings, agentStats } from "@/server/dashboard";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const user = await requireRole("agent", "/dashboard");
  const rows = await agentListings(user.id);
  const stats = await agentStats(user.id, rows);
  const tiles: [string, number, IconName, string][] = [
    ["Active listings", stats.active, "home", "/dashboard/listings"],
    ["Pending review", stats.pending, "clock", "/dashboard/listings"],
    ["Expiring this week", stats.expiring, "alert", "/dashboard/listings"],
    ["Leads this week", stats.leadsThisWeek, "message", "/dashboard/leads"],
  ];
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">Hello, {user.name.split(" ")[0]}</h1>
          <p className="m-0 mt-1 text-muted">Here’s how your listings are doing.</p>
        </div>
        <ButtonLink href="/dashboard/listings/new" variant="secondary" className="lg:hidden">
          Post listing
        </ButtonLink>
      </div>

      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
        {tiles.map(([label, value, icon, href]) => (
          <li key={label}>
            <Link href={href} className="flex h-full flex-col gap-2 rounded-[10px] border border-line bg-surface p-4 !text-ink no-underline hover:border-green">
              <span className="flex items-center gap-2 text-sm text-muted">
                <Icon n={icon} size={16} />
                {label}
              </span>
              <span className={`font-mono text-[28px] font-medium leading-8 ${label === "Expiring this week" && value > 0 ? "text-amber" : ""}`}>{value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="m-0 font-display text-2xl font-semibold">Your listings</h2>
          {rows.length > 6 ? <Link href="/dashboard/listings" className="text-sm font-semibold">See all {rows.length}</Link> : null}
        </div>
        {rows.length ? <ListingsTable rows={rows.slice(0, 6)} /> : <EmptyListings />}
      </section>
    </div>
  );
}
