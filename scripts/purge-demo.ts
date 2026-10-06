import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { listings, users } from "@/db/schema";

/** Deletes every is_demo row. Run once at launch, then set DEMO_MODE=off. */
async function main() {
  const l = await db.delete(listings).where(eq(listings.isDemo, true)).returning({ id: listings.id });
  const u = await db.delete(users).where(eq(users.isDemo, true)).returning({ id: users.id });
  console.log(`Deleted ${l.length} demo listings and ${u.length} demo users (with their profiles, leads and terms).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
