import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentProfiles, areas, listings } from "@/db/schema";
import { publicEnv } from "@/lib/public-env";
import { publicVisible } from "@/server/search";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const [ls, as, ags] = await Promise.all([
    db.select({ slug: listings.slug, updatedAt: listings.updatedAt }).from(listings).where(publicVisible()),
    db.select({ slug: areas.slug }).from(areas).where(eq(areas.isActive, true)),
    db.select({ slug: agentProfiles.slug }).from(agentProfiles).where(and(eq(agentProfiles.status, "verified"))),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/for-agents`, changeFrequency: "monthly", priority: 0.5 },
    ...as.map((a) => ({ url: `${base}/search?area=${a.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...ls.map((l) => ({ url: `${base}/listing/${l.slug}`, lastModified: l.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...ags.map((a) => ({ url: `${base}/agents/${a.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
