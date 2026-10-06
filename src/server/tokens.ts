import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Short signed tokens for one-click links in emails (renew a listing).
 * Format: base64url(payload).base64url(hmac). Payload carries its own expiry.
 */
export function sign(purpose: string, subject: string, ttlDays: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
  const payload = Buffer.from(JSON.stringify({ p: purpose, s: subject, e: exp })).toString("base64url");
  const mac = createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verify(token: string, purpose: string): string | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { p, s, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p: string; s: string; e: number };
    if (p !== purpose || e < Date.now() / 1000) return null;
    return s;
  } catch {
    return null;
  }
}
