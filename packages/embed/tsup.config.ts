import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "es2017",
  dts: true,
  sourcemap: true,
  clean: false,
  minify: false,
  define: {
    __CODATUM_EMBED_JS_VERSION__: JSON.stringify(pkg.version),
  },
  outExtension({ format }) {
    if (format === "cjs") return { js: ".cjs" };
    return { js: ".js" };
  },
});
