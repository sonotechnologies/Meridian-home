import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  var __meridianSql: ReturnType<typeof postgres> | undefined;
}

// Reuse one pool across hot reloads in development. On Neon, DATABASE_URL is
// the pooled connection string, so prepared statements are turned off.
const client = globalThis.__meridianSql ?? postgres(env.DATABASE_URL, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalThis.__meridianSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
