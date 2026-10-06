import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";

export type UploadKind = "listing" | "agent-photo" | "id-document";

const cloudinaryOn = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
if (cloudinaryOn) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export type UploadTarget =
  | { provider: "cloudinary"; url: string; fields: Record<string, string> }
  | { provider: "local"; url: string; fields: Record<string, string> };

/**
 * Where the browser should POST a file. With Cloudinary this is a signed direct
 * upload; ID documents use the "authenticated" type so they have no public URL.
 */
export function uploadTarget(kind: UploadKind, ownerId: string): UploadTarget {
  if (!cloudinaryOn) return { provider: "local", url: "/api/uploads", fields: { kind } };
  const timestamp = Math.round(Date.now() / 1000).toString();
  const folder = kind === "id-document" ? `meridian/id/${ownerId}` : `meridian/${kind}/${ownerId}`;
  const params: Record<string, string> = { timestamp, folder };
  if (kind === "id-document") params.type = "authenticated";
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);
  return {
    provider: "cloudinary",
    url: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    fields: { ...params, signature, api_key: env.CLOUDINARY_API_KEY! },
  };
}

/** Local stub: public images go to public/uploads, ID documents to a private folder outside public. */
const PUBLIC_DIR = path.join(process.cwd(), "public", "uploads");
const PRIVATE_DIR = path.join(process.cwd(), ".private-uploads");

export async function saveLocalUpload(kind: UploadKind, ownerId: string, file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("That file is over 10 MB. Try a smaller one.");
  if (!ACCEPTED_TYPES.includes(file.type)) throw new UploadError("Upload a JPG, PNG, WebP or HEIC photo, or a PDF.");
  if (kind !== "id-document" && file.type === "application/pdf") throw new UploadError("Photos must be JPG, PNG, WebP or HEIC.");
  const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
  const name = `${nanoid(12)}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (kind === "id-document") {
    const dir = path.join(PRIVATE_DIR, ownerId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), bytes);
    return `private:${ownerId}/${name}`;
  }
  const dir = path.join(PUBLIC_DIR, kind, ownerId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${kind}/${ownerId}/${name}`;
}

export class UploadError extends Error {}

/** Short-lived URL the admin can open to view an ID document. */
export function privateDocumentUrl(key: string): string {
  if (key.startsWith("private:")) return `/api/admin/id-document?key=${encodeURIComponent(key)}`;
  // Cloudinary authenticated asset: key is the public_id.
  return cloudinary.utils.private_download_url(key, "", {
    type: "authenticated",
    expires_at: Math.round(Date.now() / 1000) + 600,
  });
}

export async function readPrivateDocument(key: string): Promise<{ bytes: Buffer; type: string } | null> {
  const rel = key.replace(/^private:/, "");
  const full = path.resolve(PRIVATE_DIR, rel);
  if (!full.startsWith(PRIVATE_DIR + path.sep)) return null;
  try {
    const bytes = await readFile(full);
    const type = full.endsWith(".pdf") ? "application/pdf" : `image/${path.extname(full).slice(1).replace("jpg", "jpeg")}`;
    return { bytes, type };
  } catch {
    return null;
  }
}

/** ID documents are deleted 30 days after the admin's decision. */
export async function deletePrivateDocument(key: string): Promise<void> {
  if (key.startsWith("private:")) {
    const full = path.resolve(PRIVATE_DIR, key.replace(/^private:/, ""));
    if (full.startsWith(PRIVATE_DIR + path.sep)) await unlink(full).catch(() => {});
    return;
  }
  if (cloudinaryOn) await cloudinary.uploader.destroy(key, { type: "authenticated", invalidate: true });
}
