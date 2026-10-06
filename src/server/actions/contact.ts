"use server";

import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leads, listings, reports } from "@/db/schema";
import { CallbackEmail } from "@/emails/templates";
import { whatsappMessage } from "@/lib/contact-message";
import { normaliseNigerianPhone } from "@/lib/format";
import { REPORTS_TO_HIDE } from "@/lib/listing-rules";
import { publicEnv } from "@/lib/public-env";
import { sendEmail } from "@/server/email";
import { getListingBySlug, listingVisibility } from "@/server/listing";
import { getUser } from "@/server/session";

async function contactable(slug: string) {
  const l = await getListingBySlug(slug);
  if (!l || listingVisibility(l, null) !== "public") return null;
  return l;
}

/**
 * Logs a WhatsApp lead on click, before the redirect. Name and phone stay empty
 * for visitors. Demo listings return a notice instead of a WhatsApp link.
 */
export async function startWhatsApp(slug: string): Promise<{ ok: true; url: string | null; demo: boolean } | { ok: false; error: string }> {
  const l = await contactable(slug);
  if (!l || !l.agent?.whatsapp) return { ok: false, error: "This listing is no longer available." };
  const user = await getUser();
  await db.insert(leads).values({
    listingId: l.id,
    agentId: l.agentId,
    userId: user?.id ?? null,
    name: user?.name ?? null,
    channel: "whatsapp",
  });
  if (l.isDemo || l.agent.isDemo) return { ok: true, url: null, demo: true };
  const text = whatsappMessage({ ...l, agentName: l.agent.name ?? "there" });
  const digits = l.agent.whatsapp.replace(/\D/g, "");
  return { ok: true, url: `https://wa.me/${digits}?text=${encodeURIComponent(text)}`, demo: false };
}

const callbackSchema = z.object({
  slug: z.string().min(1).max(200),
  name: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.string().transform((v, ctx) => {
    const n = normaliseNigerianPhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter an 11-digit Nigerian number, like 0803 412 7781." });
    return n ?? "";
  }),
  time: z.enum(["Morning", "Afternoon", "Evening"]),
  message: z.string().trim().max(500).optional(),
});
export type CallbackInput = z.input<typeof callbackSchema>;
export type FieldErrors = Partial<Record<"name" | "phone" | "message", string>>;

export async function requestCallback(input: CallbackInput): Promise<{ ok: true; demo: boolean } | { ok: false; errors?: FieldErrors; error?: string }> {
  const parsed = callbackSchema.safeParse(input);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const i of parsed.error.issues) errors[i.path[0] as keyof FieldErrors] ??= i.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  const l = await contactable(d.slug);
  if (!l) return { ok: false, error: "This listing is no longer available." };
  const user = await getUser();
  await db.insert(leads).values({
    listingId: l.id,
    agentId: l.agentId,
    userId: user?.id ?? null,
    name: d.name,
    phone: d.phone,
    message: [`Best time: ${d.time.toLowerCase()}`, d.message].filter(Boolean).join(". "),
    channel: "callback",
  });
  if (l.agent?.email) {
    const listingUrl = `${publicEnv.siteUrl}/listing/${l.slug}`;
    await sendEmail({
      to: l.agent.email,
      subject: `Call-back request: ${l.title}`,
      react: CallbackEmail({
        agentName: l.agent.name ?? "",
        buyerName: d.name,
        phone: d.phone,
        time: d.time,
        message: d.message,
        listingTitle: l.title,
        listingUrl,
        dashboardUrl: `${publicEnv.siteUrl}/dashboard/leads`,
      }),
      text: `${d.name} wants a call-back about ${l.title} (${listingUrl}).\nPhone: ${d.phone}\nBest time: ${d.time}${d.message ? `\n"${d.message}"` : ""}`,
    }).catch((e) => console.error("call-back email failed", e));
  }
  return { ok: true, demo: l.isDemo };
}

const reportSchema = z.object({
  slug: z.string().min(1).max(200),
  reason: z.enum(["taken", "fake", "wrong-price", "wrong-location", "other"]),
  note: z.string().trim().max(500).optional(),
});

/** Three unresolved reports hide the listing until an admin reviews it. */
export async function reportListing(input: z.input<typeof reportSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a reason." };
  const l = await getListingBySlug(parsed.data.slug);
  if (!l) return { ok: false, error: "This listing no longer exists." };
  await db.insert(reports).values({ listingId: l.id, reason: parsed.data.reason, note: parsed.data.note || null });
  const [{ n }] = await db
    .select({ n: count() })
    .from(reports)
    .where(and(eq(reports.listingId, l.id), eq(reports.resolved, false)));
  if (n >= REPORTS_TO_HIDE) {
    await db.update(listings).set({ hiddenByReports: true }).where(eq(listings.id, l.id));
  }
  return { ok: true };
}
