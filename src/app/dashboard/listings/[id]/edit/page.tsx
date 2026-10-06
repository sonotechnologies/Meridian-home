import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/dashboard/listing-form";
import { formAreas, isTrusted, loadListingForm } from "@/server/listing-form-data";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> };

export default async function EditListingPage({ params, searchParams }: Props) {
  const [{ id }, { step }] = await Promise.all([params, searchParams]);
  const user = await requireRole("agent", `/dashboard/listings/${id}/edit`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [data, areas, trusted] = await Promise.all([loadListingForm(user.id, id), formAreas(), isTrusted(user.id, user.isDemo)]);
  if (!data || data.status === "closed") notFound();
  const wanted = Number(step) || (data.status === "draft" ? data.draftStep : 1);
  return (
    <ListingForm
      listingId={id}
      initial={data.form}
      initialStep={Math.min(wanted, data.draftStep)}
      reached={data.draftStep}
      areas={areas}
      trusted={trusted}
      status={data.status}
    />
  );
}
