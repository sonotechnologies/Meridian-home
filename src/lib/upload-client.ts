"use client";

import { getUploadTarget } from "@/server/actions/agent";
import type { UploadKind } from "@/server/images";

const MAX = 10 * 1024 * 1024;

/**
 * Uploads a file straight to Cloudinary (signed) or to the local stand-in.
 * Returns the public URL, or for ID documents the private storage key.
 */
export async function uploadFile(kind: UploadKind, file: File): Promise<string> {
  if (file.size > MAX) throw new Error(`“${file.name}” is over 10 MB. Try a smaller one.`);
  const target = await getUploadTarget(kind);
  const body = new FormData();
  for (const [k, v] of Object.entries(target.fields)) body.append(k, v);
  body.append("file", file);
  const r = await fetch(target.url, { method: "POST", body });
  const data = (await r.json().catch(() => ({}))) as { url?: string; secure_url?: string; public_id?: string; error?: string | { message: string } };
  if (!r.ok) {
    const msg = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(msg ?? `“${file.name}” didn’t upload. Check your connection and try again.`);
  }
  if (target.provider === "cloudinary") return kind === "id-document" ? data.public_id! : data.secure_url!;
  return data.url!;
}
