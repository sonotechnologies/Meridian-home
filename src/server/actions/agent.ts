"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import {
  agentProfiles,
  listingImages,
  listingRentTerms,
  listingSaleTerms,
  listingShortletTerms,
  listings,
  users,
} from "@/db/schema";
import { normaliseNigerianPhone, slugify } from "@/lib/format";
import {
  agentApplicationSchema,
  issuesToErrors,
  priceStepFor,
  profileSchema,
  stepSchemas,
  type StepNumber,
} from "@/lib/listing-schema";
import { APPROVALS_BEFORE_AUTOPUBLISH, distanceMetres, expiryFrom, feeAmount, publicOffset, totalUpfront } from "@/lib/listing-rules";
import { uploadTarget, type UploadKind } from "@/server/images";
import { assertRole, getUser } from "@/server/session";

type Fail = { ok: false; errors?: Record<string, string>; error?: string };

async function ownListing(agentId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [l] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.agentId, agentId)))
    .limit(1);
  return l ?? null;
}

async function uniqueSlug(title: string, area: string | null, selfId?: string) {
  const base = slugify(`${title} ${area ?? ""}`) || "home";
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${nanoid(4).toLowerCase()}`;
    const [hit] = await db.select({ id: listings.id }).from(listings).where(eq(listings.slug, slug)).limit(1);
    if (!hit || hit.id === selfId) return slug;
  }
  return `${base}-${nanoid(8).toLowerCase()}`;
}

/**
 * Saves one step of the listing form as a draft. Creates the draft on the first
 * save. Each step is validated with the same schema the form uses.
 */
export async function saveListingStep(
  listingId: string | null,
  step: StepNumber,
  data: unknown,
): Promise<{ ok: true; id: string } | Fail> {
  const user = await assertRole("agent");
  const existing = listingId ? await ownListing(user.id, listingId) : null;
  if (listingId && !existing) return { ok: false, error: "That listing isn’t yours or no longer exists." };

  const schema = step === 4 ? priceStepFor((existing?.type ?? "rent") as "rent" | "sale" | "shortlet") : stepSchemas[step];
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, errors: issuesToErrors(parsed.error.issues) };
  const d = parsed.data as Record<string, unknown>;

  // Demo agents work in a sandbox: never public, reset nightly.
  const sandbox = user.isDemo ? { sandbox: true } : {};

  if (!existing) {
    if (step !== 1) return { ok: false, error: "Start with the first step." };
    const s1 = d as z.infer<(typeof stepSchemas)[1]>;
    const [row] = await db
      .insert(listings)
      .values({
        agentId: user.id,
        slug: await uniqueSlug(s1.title, null),
        type: s1.type,
        propertyType: s1.propertyType as never,
        title: s1.title,
        description: s1.description,
        status: "draft",
        draftStep: 2,
        isDemo: user.isDemo,
        ...sandbox,
      })
      .returning();
    revalidatePath("/dashboard/listings");
    return { ok: true, id: row!.id };
  }

  const id = existing.id;
  const nextStep = Math.max(existing.draftStep, step + 1);
  // Editing a live listing before the agent is trusted sends it back for review.
  const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, user.id)).limit(1);
  const trusted = (profile?.approvedListingCount ?? 0) >= APPROVALS_BEFORE_AUTOPUBLISH;
  const backToReview = existing.status === "active" && !trusted && !user.isDemo ? { status: "pending" as const } : {};

  if (step === 1) {
    const s1 = d as z.infer<(typeof stepSchemas)[1]>;
    const typeChanged = s1.type !== existing.type;
    await db
      .update(listings)
      .set({ type: s1.type, propertyType: s1.propertyType as never, title: s1.title, description: s1.description, draftStep: nextStep, ...sandbox, ...backToReview })
      .where(eq(listings.id, id));
    if (typeChanged) {
      // Terms belong to one type; clear the others so a type switch can't leave stale fees.
      await Promise.all([
        db.delete(listingRentTerms).where(eq(listingRentTerms.listingId, id)),
        db.delete(listingSaleTerms).where(eq(listingSaleTerms.listingId, id)),
        db.delete(listingShortletTerms).where(eq(listingShortletTerms.listingId, id)),
      ]);
    }
  } else if (step === 2) {
    const s2 = d as z.infer<(typeof stepSchemas)[2]>;
    const prev = existing.location;
    const moved = !prev || distanceMetres(prev, { x: s2.lng, y: s2.lat }) > 10;
    await db
      .update(listings)
      .set({
        areaId: s2.areaId,
        location: { x: s2.lng, y: s2.lat },
        // The public point is generated once and only regenerated if the pin really moves.
        ...(moved || !existing.publicLocation ? { publicLocation: publicOffset(s2.lng, s2.lat) } : {}),
        streetName: s2.streetName || null,
        showStreet: s2.showStreet,
        draftStep: nextStep,
        ...sandbox,
        ...backToReview,
      })
      .where(eq(listings.id, id));
  } else if (step === 3) {
    const s3 = d as z.infer<(typeof stepSchemas)[3]>;
    await db
      .update(listings)
      .set({ ...s3, sizeSqm: s3.sizeSqm ?? null, amenities: s3.amenities, draftStep: nextStep, ...sandbox, ...backToReview })
      .where(eq(listings.id, id));
  } else if (step === 4) {
    const s4 = d as z.infer<(typeof stepSchemas)[4]>;
    await db.update(listings).set({ price: s4.price, draftStep: nextStep, ...sandbox, ...backToReview }).where(eq(listings.id, id));
    if (existing.type === "rent" && s4.rent) {
      const fees = {
        agencyFee: feeAmount(s4.rent.agencyFee, s4.price),
        legalFee: feeAmount(s4.rent.legalFee, s4.price),
        cautionDeposit: feeAmount(s4.rent.cautionDeposit, s4.price),
        serviceCharge: feeAmount(s4.rent.serviceCharge, s4.price),
      };
      const row = { listingId: id, ...fees, totalUpfront: totalUpfront(s4.price, fees) };
      await db.insert(listingRentTerms).values(row).onConflictDoUpdate({ target: listingRentTerms.listingId, set: row });
    } else if (existing.type === "sale" && s4.sale) {
      const row = { listingId: id, titleDocument: s4.sale.titleDocument as never, negotiable: s4.sale.negotiable };
      await db.insert(listingSaleTerms).values(row).onConflictDoUpdate({ target: listingSaleTerms.listingId, set: row });
    } else if (existing.type === "shortlet" && s4.shortlet) {
      const row = { listingId: id, ...s4.shortlet };
      await db.insert(listingShortletTerms).values(row).onConflictDoUpdate({ target: listingShortletTerms.listingId, set: row });
    }
  } else if (step === 5) {
    const s5 = d as z.infer<(typeof stepSchemas)[5]>;
    // Only images this agent uploaded: local stub paths or this agent's Cloudinary folder.
    const allowed = s5.images.every((u) => u.startsWith(`/uploads/listing/${user.id}/`) || u.includes(`/meridian/listing/${user.id}/`));
    if (!allowed) return { ok: false, errors: { images: "Some photos didn’t upload properly. Remove them and try again." } };
    await db.transaction(async (tx) => {
      await tx.delete(listingImages).where(eq(listingImages.listingId, id));
      await tx.insert(listingImages).values(s5.images.map((url, position) => ({ listingId: id, url, position })));
      await tx.update(listings).set({ draftStep: nextStep, ...sandbox, ...backToReview }).where(eq(listings.id, id));
    });
  }
  revalidatePath("/dashboard/listings");
  revalidatePath(`/listing/${existing.slug}`);
  return { ok: true, id };
}

/** Final check of every step, then publish or queue for review. */
export async function submitListing(id: string): Promise<{ ok: true; status: "pending" | "active"; slug: string } | Fail> {
  const user = await assertRole("agent");
  const l = await ownListing(user.id, id);
  if (!l) return { ok: false, error: "That listing isn’t yours or no longer exists." };
  const missing: string[] = [];
  if (!l.title || l.description.length < 40) missing.push("Type and basics");
  if (!l.areaId || !l.location) missing.push("Location");
  if (!l.price) missing.push("Price");
  const terms =
    l.type === "rent"
      ? await db.select().from(listingRentTerms).where(eq(listingRentTerms.listingId, id))
      : l.type === "sale"
        ? await db.select().from(listingSaleTerms).where(eq(listingSaleTerms.listingId, id))
        : await db.select().from(listingShortletTerms).where(eq(listingShortletTerms.listingId, id));
  if (!terms.length && !missing.includes("Price")) missing.push("Price");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(listingImages).where(eq(listingImages.listingId, id));
  if (n < 4) missing.push("Photos");
  if (missing.length) return { ok: false, error: `Finish these steps first: ${missing.join(", ")}.` };

  const [profile] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, user.id)).limit(1);
  const trusted = (profile?.approvedListingCount ?? 0) >= APPROVALS_BEFORE_AUTOPUBLISH || user.isDemo;
  const [area] = await db.execute<{ name: string }>(sql`select name from areas where id = ${l.areaId}`);
  const slug = l.status === "draft" ? await uniqueSlug(l.title, area?.name ?? null, l.id) : l.slug;
  const now = new Date();
  const status = trusted ? "active" : "pending";
  await db
    .update(listings)
    .set({
      slug,
      status,
      draftStep: 6,
      rejectionReason: null,
      ...(status === "active" ? { publishedAt: now, expiresAt: expiryFrom(now), expiryRemindedAt: null } : {}),
    })
    .where(eq(listings.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  return { ok: true, status, slug };
}

/** "Still available": active again for 30 days from today. */
export async function renewListing(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await assertRole("agent");
  const l = await ownListing(user.id, id);
  if (!l || !(l.status === "active" || l.status === "expired")) return { ok: false, error: "Only active or expired listings can be renewed." };
  const now = new Date();
  await db
    .update(listings)
    .set({ status: "active", publishedAt: now, expiresAt: expiryFrom(now), expiryRemindedAt: null })
    .where(eq(listings.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath(`/listing/${l.slug}`);
  return { ok: true };
}

export async function closeListing(id: string, reason: "meridian" | "elsewhere" | "withdrawn"): Promise<{ ok: boolean; error?: string }> {
  const user = await assertRole("agent");
  if (!["meridian", "elsewhere", "withdrawn"].includes(reason)) return { ok: false, error: "Pick a reason." };
  const l = await ownListing(user.id, id);
  if (!l) return { ok: false, error: "That listing isn’t yours or no longer exists." };
  await db.update(listings).set({ status: "closed", closedReason: reason }).where(eq(listings.id, id));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath(`/listing/${l.slug}`);
  return { ok: true };
}

export async function deleteDraft(id: string): Promise<{ ok: boolean }> {
  const user = await assertRole("agent");
  const l = await ownListing(user.id, id);
  if (!l || l.status !== "draft") return { ok: false };
  await db.delete(listings).where(eq(listings.id, id));
  revalidatePath("/dashboard/listings");
  return { ok: true };
}

/** Signed upload target for the browser. Agents upload listing photos and profile photos; applicants upload ID. */
export async function getUploadTarget(kind: UploadKind) {
  const user = await getUser();
  if (!user) throw new Error("Sign in first.");
  if (kind === "listing" && user.role !== "agent") throw new Error("Not allowed");
  return uploadTarget(kind, user.id);
}

/** Agent application. The applicant stays a buyer with a "pending" notice until an admin approves. */
export async function applyAsAgent(input: z.input<typeof agentApplicationSchema>): Promise<{ ok: true } | Fail> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (user.role !== "buyer") return { ok: false, error: "This account is already an agent or admin." };
  const parsed = agentApplicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesToErrors(parsed.error.issues) };
  const d = parsed.data;
  const phone = normaliseNigerianPhone(d.phone);
  const whatsapp = normaliseNigerianPhone(d.whatsapp);
  const errors: Record<string, string> = {};
  if (!phone) errors.phone = "Enter an 11-digit Nigerian number, like 0803 412 7781.";
  if (!whatsapp) errors.whatsapp = "Enter an 11-digit Nigerian number, like 0803 412 7781.";
  if (!d.idDocument.startsWith(`private:${user.id}/`) && !d.idDocument.startsWith(`meridian/id/${user.id}/`)) {
    errors.idDocument = "Upload your ID again.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const [existing] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, user.id)).limit(1);
  if (existing && existing.status === "pending") return { ok: false, error: "Your application is already with us. We’ll email you." };
  if (existing && existing.status === "suspended") return { ok: false, error: "This account is suspended." };

  const row = {
    userId: user.id,
    slug: existing?.slug ?? (await uniqueAgentSlug(d.fullName)),
    fullName: d.fullName,
    agencyName: d.agencyName,
    phone: phone!,
    whatsapp: whatsapp!,
    cacNumber: d.cacNumber?.toUpperCase() || null,
    idDocumentUrl: d.idDocument,
    status: "pending" as const,
    rejectionReason: null,
    decidedAt: null,
  };
  await db.insert(agentProfiles).values(row).onConflictDoUpdate({ target: agentProfiles.userId, set: row });
  await db.update(users).set({ name: d.fullName }).where(eq(users.id, user.id));
  revalidatePath("/for-agents");
  return { ok: true };
}

async function uniqueAgentSlug(name: string) {
  const base = slugify(name) || "agent";
  for (let i = 0; i < 10; i++) {
    const slug = i === 0 ? base : `${base}-${nanoid(4).toLowerCase()}`;
    const [hit] = await db.select({ id: agentProfiles.userId }).from(agentProfiles).where(eq(agentProfiles.slug, slug)).limit(1);
    if (!hit) return slug;
  }
  return `${base}-${nanoid(8).toLowerCase()}`;
}

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<{ ok: true } | Fail> {
  const user = await assertRole("agent");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: issuesToErrors(parsed.error.issues) };
  const whatsapp = normaliseNigerianPhone(parsed.data.whatsapp);
  if (!whatsapp) return { ok: false, errors: { whatsapp: "Enter an 11-digit Nigerian number, like 0803 412 7781." } };
  const photo = parsed.data.photoUrl;
  if (photo && !photo.startsWith(`/uploads/agent-photo/${user.id}/`) && !photo.includes(`/meridian/agent-photo/${user.id}/`)) {
    return { ok: false, errors: { photoUrl: "Upload the photo again." } };
  }
  await db
    .update(agentProfiles)
    .set({ agencyName: parsed.data.agencyName, whatsapp, bio: parsed.data.bio || null, photoUrl: photo || null })
    .where(eq(agentProfiles.userId, user.id));
  revalidatePath("/dashboard/profile");
  return { ok: true };
}
