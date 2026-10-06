import type { Metadata } from "next";
import { ListingForm } from "@/components/dashboard/listing-form";
import { EMPTY_FORM } from "@/lib/listing-form-state";
import { formAreas, isTrusted } from "@/server/listing-form-data";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Post a listing", robots: { index: false } };

export default async function NewListingPage() {
  const user = await requireRole("agent", "/dashboard/listings/new");
  const [areas, trusted] = await Promise.all([formAreas(), isTrusted(user.id, user.isDemo)]);
  return <ListingForm listingId={null} initial={EMPTY_FORM} initialStep={1} reached={1} areas={areas} trusted={trusted} status="draft" />;
}
