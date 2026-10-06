import { naira, priceUnit, type ListingType } from "./format";
import { publicEnv } from "./public-env";

/** The pre-filled WhatsApp message: listing title and link; a viewing or an availability enquiry by type. */
export function whatsappMessage(l: { title: string; areaName: string | null; price: number; type: ListingType; slug: string; agentName: string }) {
  const first = l.agentName.split(" ")[0];
  const unit = priceUnit(l.type);
  const link = `${publicEnv.siteUrl}/listing/${l.slug}`;
  const what = `the ${l.title}${l.areaName ? ` in ${l.areaName}` : ""} on Meridian (${naira(l.price)}${unit ? " " + unit : ""})`;
  return l.type === "shortlet"
    ? `Hello ${first}, I saw ${what}. Is it available? Which dates are free? ${link}`
    : `Hello ${first}, I saw ${what}. Is it still available? I'd like to book a viewing. ${link}`;
}
