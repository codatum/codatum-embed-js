import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5175,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
});
