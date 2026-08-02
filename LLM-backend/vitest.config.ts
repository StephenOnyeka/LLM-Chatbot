import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node environment (this is a backend API, no DOM needed).
    environment: "node",
    // `setup.env.ts` populates process.env BEFORE any src module is imported,
    // so config/env.ts (which process.exit(1)s on missing vars) can parse.
    setupFiles: ["./test/setup.env.ts"],
    // Run test files sequentially in a single fork. Several src modules hold
    // singletons (the pg pool, the redis client), and the API tests mock those
    // modules; a single process keeps the module registry and mocks predictable.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    include: ["test/**/*.test.ts"],
    // Fail fast if a test hangs on an unmocked network call.
    testTimeout: 15_000,
    clearMocks: true,
  },
});
