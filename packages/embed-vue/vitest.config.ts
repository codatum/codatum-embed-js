import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,vue}"],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 85,
        lines: 80,
      },
    },
  },
});
