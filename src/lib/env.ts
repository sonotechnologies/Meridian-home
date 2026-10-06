import { z } from "zod";

/**
 * Server environment. External services are optional so the app runs locally
 * without keys; each service module falls back to a stub when its key is missing.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1).default("postgres://meridian:meridian@localhost:5432/meridian"),
  BETTER_AUTH_SECRET: z.string().min(16).default("dev-secret-change-me-in-production"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Meridian <hello@meridian.local>"),
  CRON_SECRET: z.string().default("dev-cron-secret"),
  DEMO_MODE: z
    .enum(["on", "off"])
    .default("on")
    .transform((v) => v === "on"),
});

export const env = schema.parse(process.env);

/** Public, safe for the browser. */
export const publicEnv = {
  tileStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};
