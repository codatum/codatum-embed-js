import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
  },
  define: {
    __CODATUM_EMBED_JS_VERSION__: JSON.stringify(pkg.version),
  },
});
