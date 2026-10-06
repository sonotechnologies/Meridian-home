import { z } from "zod";
import { PROPERTY_TYPES, TITLE_DOCUMENTS } from "./format";
import { AMENITIES } from "./listing-rules";

/**
 * One schema per form step, shared by the client (validating before moving on)
 * and the server action that saves the step.
 */
const naira = (msg: string) =>
  z.coerce.number({ error: msg }).int(msg).min(0, msg).max(100_000_000_000, "That amount looks too large.");

const fee = z.object({
  mode: z.enum(["amount", "percent"]),
  value: z.coerce.number().min(0, "Enter 0 or more.").max(100_000_000_000),
});

export const stepSchemas = {
  1: z.object({
    type: z.enum(["rent", "sale", "shortlet"]),
    propertyType: z.enum(PROPERTY_TYPES.map(([v]) => v) as [string, ...string[]]),
    title: z.string().trim().min(8, "Give it a title of at least 8 characters, like “2 bedroom flat with BQ”.").max(80, "Keep the title under 80 characters."),
    description: z.string().trim().min(40, "Describe the home in at least 40 characters: water, power, security, what’s nearby.").max(3000),
  }),
  2: z.object({
    areaId: z.coerce.number({ error: "Choose an area." }).int().positive("Choose an area."),
    // Lagos, roughly. Keeps a dragged pin from landing in the Atlantic.
    lng: z.coerce.number().min(2.7, "Move the pin onto the building in Lagos.").max(4.4, "Move the pin onto the building in Lagos."),
    lat: z.coerce.number().min(6.35, "Move the pin onto the building in Lagos.").max(6.75, "Move the pin onto the building in Lagos."),
    streetName: z.string().trim().max(80).optional(),
    showStreet: z.coerce.boolean(),
  }),
  3: z.object({
    bedrooms: z.coerce.number().int().min(0).max(30),
    bathrooms: z.coerce.number().int().min(0).max(30),
    toilets: z.coerce.number().int().min(0).max(40),
    parking: z.coerce.number().int().min(0).max(50),
    sizeSqm: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(5, "Size looks too small.").max(100_000).optional()),
    furnished: z.coerce.boolean(),
    serviced: z.coerce.boolean(),
    amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length),
  }),
  4: z.object({
    price: naira("Enter the price in naira, numbers only.").refine((n) => n > 0, "Enter the price in naira."),
    rent: z
      .object({ agencyFee: fee, legalFee: fee, cautionDeposit: fee, serviceCharge: fee })
      .optional(),
    sale: z.object({ titleDocument: z.enum(TITLE_DOCUMENTS.map(([v]) => v) as [string, ...string[]]), negotiable: z.coerce.boolean() }).optional(),
    shortlet: z
      .object({
        minNights: z.coerce.number().int().min(1, "At least 1 night.").max(365),
        cleaningFee: naira("Enter the cleaning fee, or 0."),
        cautionDeposit: naira("Enter the caution deposit, or 0."),
      })
      .optional(),
  }),
  5: z.object({
    images: z
      .array(z.string().min(1).max(500))
      .min(4, "Add at least 4 photos. Buyers skip listings with fewer.")
      .max(15, "You can add up to 15 photos."),
  }),
} as const;

export type StepNumber = keyof typeof stepSchemas;
export type StepData<S extends StepNumber> = z.infer<(typeof stepSchemas)[S]>;

export const STEP_NAMES = ["Type and basics", "Location", "Specs", "Price", "Photos", "Review"] as const;

/** Per-type check that step 4 carries the fields for that listing type. */
export function priceStepFor(type: "rent" | "sale" | "shortlet") {
  return stepSchemas[4].superRefine((d, ctx) => {
    if (type === "rent" && !d.rent) ctx.addIssue({ code: "custom", path: ["rent"], message: "Add the fees, or 0 for none." });
    if (type === "sale" && !d.sale) ctx.addIssue({ code: "custom", path: ["sale"], message: "Choose the title document." });
    if (type === "shortlet" && !d.shortlet) ctx.addIssue({ code: "custom", path: ["shortlet"], message: "Add the minimum stay and fees." });
  });
}

/** Flattens Zod issues to { "rent.agencyFee.value": "message" } for field-level errors. */
export function issuesToErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.join(".") || "form";
    out[k] ??= i.message;
  }
  return out;
}

export const agentApplicationSchema = z.object({
  fullName: z.string().trim().min(3, "Enter your full name as it appears on your ID.").max(80),
  agencyName: z.string().trim().min(2, "Enter your agency name, or your own name if you work alone.").max(80),
  // Format is checked by normaliseNigerianPhone in the action, which gives the specific message.
  phone: z.string().trim().min(1, "Enter your phone number."),
  whatsapp: z.string().trim().min(1, "Enter the WhatsApp number buyers should message."),
  cacNumber: z
    .string()
    .trim()
    .max(20)
    .regex(/^(RC|BN|IT)?\s?\d{5,8}$|^$/i, "CAC numbers look like RC 1234567 or BN 123456.")
    .optional(),
  idDocument: z.string().min(1, "Upload a photo of your government ID."),
});

export const profileSchema = z.object({
  agencyName: z.string().trim().min(2).max(80),
  whatsapp: z.string().trim().min(1, "Enter the WhatsApp number buyers should message."),
  bio: z.string().trim().max(600, "Keep your bio under 600 characters.").optional(),
  photoUrl: z.string().max(500).optional().nullable(),
});
