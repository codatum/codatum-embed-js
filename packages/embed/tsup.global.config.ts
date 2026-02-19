import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

/** CDN build: single IIFE that assigns to global CodatumEmbed (e.g. CodatumEmbed.createEmbed). */
export default defineConfig({
  entry: { "index.global": "src/global.ts" },
  format: ["iife"],
  target: "es2017",
  dts: false,
  sourcemap: true,
  clean: false,
  minify: false,
  globalName: "CodatumEmbed",
  define: {
    __CODATUM_EMBED_JS_VERSION__: JSON.stringify(pkg.version),
  },
  outExtension() {
    return { js: ".min.js" };
  },
});
