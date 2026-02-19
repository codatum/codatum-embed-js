import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}"],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 85,
        lines: 80,
      },
    },
  },
});
