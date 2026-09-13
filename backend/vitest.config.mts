import { defineConfig } from "vitest/config";

// Only run the TypeScript source tests. Without this, Vitest also picks up the
// compiled *.test.js files under dist/ (CommonJS), which can't import Vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
