import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
      include: ["src/**/*.ts", "src/**/*.vue"],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "CodatumEmbedVue",
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["vue", "@codatum/embed"],
      output: {
        globals: {
          vue: "Vue",
          "@codatum/embed": "CodatumEmbed",
        },
      },
    },
    sourcemap: true,
  },
});
