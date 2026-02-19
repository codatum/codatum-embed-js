import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      outDir: "dist",
      include: ["src/**/*.ts", "src/**/*.tsx"],
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "EmbedReact",
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "@codatum/embed"],
    },
    sourcemap: true,
  },
});
