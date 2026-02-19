import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/define.d.ts"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
  },
  define: {
    __CODATUM_EMBED_JS_VERSION__: JSON.stringify(pkg.version),
  },
});
