import { ImageResponse } from "next/og";
import { naira, priceUnit, TYPE_TAG } from "@/lib/format";
import { OG_SIZE, OgFrame, OgPrice, ogFonts } from "@/lib/og";
import { getListingBySlug, listingVisibility } from "@/server/listing";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Listing on Meridian";

/** Each listing's share image: title, area, price and the total to move in. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [l, fonts] = await Promise.all([getListingBySlug((await params).slug), ogFonts()]);
  const visible = l && listingVisibility(l, null) !== "hidden";
  if (!l || !visible) {
    return new ImageResponse(<OgFrame><div style={{ fontSize: 64, fontFamily: "Fraunces", fontWeight: 600 }}>Homes in Lagos on a live map</div></OgFrame>, { ...size, fonts });
  }
  const unit = priceUnit(l.type);
  return new ImageResponse(
    (
      <OgFrame
        left={[l.bedrooms ? `${l.bedrooms} bed · ${l.bathrooms} bath` : "", l.sizeSqm ? `${l.sizeSqm} m²` : ""].filter(Boolean).join(" · ")}
        right={l.agent?.status === "verified" ? "Verified agent" : ""}
      >
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 3, color: "#5A6661" }}>
          {`${TYPE_TAG[l.type].toUpperCase()} · ${(l.areaName ?? "").toUpperCase()}`}
        </div>
        <div style={{ fontSize: 68, fontFamily: "Fraunces", fontWeight: 600, lineHeight: 1.08, maxWidth: 1000 }}>{l.title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <OgPrice amount={naira(l.price)} size={56} />
          {unit ? <span style={{ fontSize: 30, color: "#5A6661", fontFamily: "Inter" }}>{unit}</span> : null}
        </div>
        {l.type === "rent" && l.rent?.totalUpfront ? (
          <div style={{ display: "flex", fontSize: 30, color: "#1F5C4A", fontWeight: 600 }}>{`Total to move in: ${naira(l.rent.totalUpfront)}`}</div>
        ) : null}
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
