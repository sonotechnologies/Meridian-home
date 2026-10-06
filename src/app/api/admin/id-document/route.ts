import { NextResponse, type NextRequest } from "next/server";
import { readPrivateDocument } from "@/server/images";
import { getUser } from "@/server/session";

/** ID documents are private: only an admin can open them. */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user || user.role !== "admin") return new NextResponse("Not found", { status: 404 });
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const doc = await readPrivateDocument(key);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(doc.bytes), {
    headers: { "Content-Type": doc.type, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}
