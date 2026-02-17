import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { app as scenario1App } from "./scenarios/scenario1/handlers";

const PORT = 3100;

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.route("/scenario1", scenario1App);

serve({ fetch: app.fetch, port: PORT }, (info: { port: number }) => {
  console.log(`Examples server running at http://localhost:${info.port}`);
});
