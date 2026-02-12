import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const embedIifePath = path.resolve(__dirname, "../../packages/embed/dist/index.global.min.js");

export default defineConfig({
  root: __dirname,
  appType: "mpa",
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
  build: {
    rollupOptions: {
      input: {
        esm: path.resolve(__dirname, "esm.html"),
        cdn: path.resolve(__dirname, "cdn.html"),
      },
    },
  },
  plugins: [
    {
      name: "serve-embed-iife",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/embed.global.min.js" || req.url === "/packages/embed/dist/index.global.min.js") {
            if (fs.existsSync(embedIifePath)) {
              res.setHeader("Content-Type", "application/javascript");
              res.end(fs.readFileSync(embedIifePath));
              return;
            }
          }
          next();
        });
      },
    },
  ],
});
