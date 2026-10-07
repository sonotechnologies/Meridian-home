import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/saved", "/searches", "/api/", "/login", "/signup", "/email-done"] },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
