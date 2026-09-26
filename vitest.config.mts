import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // „server-only“ wirft außerhalb von React Server Components – in Tests ist es egal.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      LIEFERDANK_DB: "memory",
      LIEFERDANK_PERSIST: "off",
      PAYMENT_PROVIDER: "demo",
    },
    testTimeout: 20_000,
  },
});
