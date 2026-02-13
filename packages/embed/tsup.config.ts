import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs", "iife"],
  target: "es2017",
  dts: true,
  sourcemap: true,
  clean: false,
  minify: false,
  globalName: "CodatumEmbed",
  outExtension({ format }) {
    if (format === "iife") return { js: ".global.min.js" };
    if (format === "cjs") return { js: ".cjs" };
    return { js: ".js" };
  },
});
