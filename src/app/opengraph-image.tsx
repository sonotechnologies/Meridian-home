import { ImageResponse } from "next/og";
import { OG_SIZE, OgFrame, ogFonts } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Meridian: find a place in Lagos without the scrolling";

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <OgFrame left="Lekki · Ikoyi · Victoria Island · Ikeja · Yaba" right="6.5244° N · 3.3792° E">
        <div style={{ fontSize: 76, fontFamily: "Fraunces", fontWeight: 600, lineHeight: 1.05, maxWidth: 900 }}>Find a place in Lagos without the scrolling</div>
        <div style={{ fontSize: 32, color: "#5A6661"}}>Every home on one map, with the full cost to move in.</div>
      </OgFrame>
    ),
    { ...size, fonts },
  );
}
