import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations run on the direct (unpooled) Neon URL when one is provided.
    url:
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.DATABASE_URL ||
      "postgres://meridian:meridian@localhost:5432/meridian",
  },
  extensionsFilters: ["postgis"],
});
