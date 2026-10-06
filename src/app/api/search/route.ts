import { NextResponse, type NextRequest } from "next/server";
import { boundsSchema, parseFilters } from "@/lib/filters";
import { searchListings } from "@/server/search";

/** GET /api/search?bbox=w,s,e,n&type=rent&... Active listings inside the bounds. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const filters = parseFilters(params);
  const bboxRaw = params.get("bbox");
  const bbox = bboxRaw ? boundsSchema.safeParse(bboxRaw) : null;
  if (bbox && !bbox.success) return NextResponse.json({ error: "bbox must be west,south,east,north" }, { status: 400 });
  const result = await searchListings(filters, bbox?.data);
  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } });
}
