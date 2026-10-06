import { NextResponse, type NextRequest } from "next/server";
import { saveLocalUpload, UploadError, type UploadKind } from "@/server/images";
import { getUser } from "@/server/session";

const KINDS: UploadKind[] = ["listing", "agent-photo", "id-document"];

/** Local stand-in for Cloudinary when no keys are set. Development only. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const form = await req.formData();
  const kind = form.get("kind") as UploadKind;
  const file = form.get("file");
  if (!KINDS.includes(kind) || !(file instanceof File)) return NextResponse.json({ error: "Bad upload." }, { status: 400 });
  if ((kind === "listing" || kind === "agent-photo") && user.role !== "agent") return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  try {
    const url = await saveLocalUpload(kind, user.id, file);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
