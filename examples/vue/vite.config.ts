import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
