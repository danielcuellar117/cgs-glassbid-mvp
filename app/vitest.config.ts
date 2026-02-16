import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["../tests/app/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts"],
    },
    env: {
      TZ: "UTC",
      NODE_ENV: "test",
    },
    setupFiles: ["../tests/app/setup.ts"],
    testTimeout: 15000,
  },
});
