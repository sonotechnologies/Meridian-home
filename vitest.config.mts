import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    env: { DATABASE_URL: "postgres://meridian:meridian@localhost:5432/meridian_test" },
    fileParallelism: false,
  },
});
