import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "es2017",
  dts: true,
  sourcemap: true,
  clean: false,
  minify: false,
  outExtension({ format }) {
    if (format === "cjs") return { js: ".cjs" };
    return { js: ".js" };
  },
});
