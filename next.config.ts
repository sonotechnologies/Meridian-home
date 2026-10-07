import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Share images read the brand fonts from disk; make sure they ship with those routes.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./src/assets/fonts/**"],
    "/listing/[slug]/opengraph-image": ["./src/assets/fonts/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
