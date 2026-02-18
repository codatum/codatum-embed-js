import { defineConfig } from "tsup";

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
  outExtension() {
    return { js: ".min.js" };
  },
});
