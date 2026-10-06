import { execSync } from "node:child_process";

/** Migrate and seed the test database once per run. */
export default function setup() {
  const env = { ...process.env, DATABASE_URL: "postgres://meridian:meridian@localhost:5432/meridian_test" };
  execSync("npx drizzle-kit migrate", { env, stdio: "pipe" });
  execSync("npx tsx --tsconfig tsconfig.json scripts/seed.ts", { env, stdio: "pipe" });
}
