import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Admins are set in the database: `npm run make-admin -- someone@example.com`. */
async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run make-admin -- <email>");
  const rows = await db.update(users).set({ role: "admin" }).where(eq(users.email, email.toLowerCase())).returning({ id: users.id });
  if (!rows.length) throw new Error(`No user with email ${email}. Sign up first, then run this.`);
  console.log(`${email} is now an admin.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
