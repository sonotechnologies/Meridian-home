import type { Metadata } from "next";
import { EmptyListings, ListingsTable } from "@/components/dashboard/listings-table";
import { ButtonLink } from "@/components/ui";
import { agentListings } from "@/server/dashboard";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "My listings", robots: { index: false } };

export default async function ListingsPage() {
  const user = await requireRole("agent", "/dashboard/listings");
  const rows = await agentListings(user.id);
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 font-display text-[28px] font-semibold leading-[34px] sm:text-4xl sm:leading-[44px]">Listings</h1>
        <ButtonLink href="/dashboard/listings/new" variant="secondary">
          Post listing
        </ButtonLink>
      </div>
      <p className="m-0 max-w-[640px] text-[15px] text-muted">
        Listings stay up for 30 days. We email you 5 days before one expires; tap “Still available” to renew it.
      </p>
      {rows.length ? <ListingsTable rows={rows} /> : <EmptyListings />}
    </div>
  );
}
