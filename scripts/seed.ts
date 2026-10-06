import "dotenv/config";
import { db } from "@/db";
import { seedDemo, DEMO_AGENT_EMAIL, DEMO_PASSWORD } from "@/db/seed-data";

async function main() {
  if (process.env.DATABASE_URL?.includes("neon.tech") && !process.argv.includes("--yes")) {
    console.error("Refusing to seed a Neon database without --yes. Use a development branch.");
    process.exit(1);
  }
  await seedDemo(db, { log: console.log });
  console.log(`Demo agent: ${DEMO_AGENT_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
