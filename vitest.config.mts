import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server bundle; tests import server modules directly.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    env: { DATABASE_URL: "postgres://meridian:meridian@localhost:5432/meridian_test", NODE_ENV: "test" },
    globalSetup: ["./src/test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
