import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { app as scenario1App } from "./scenarios/scenario1/handlers";
import { app as scenario2App } from "./scenarios/scenario2/handlers";
import { app as scenario3App } from "./scenarios/scenario3/handlers";

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

app.onError((err, c) => {
  return c.json({ message: err.message }, 400);
});

app.route("/scenario1", scenario1App);
app.route("/scenario2", scenario2App);
app.route("/scenario3", scenario3App);

serve({ fetch: app.fetch, port: PORT }, (info: { port: number }) => {
  console.log(`Examples server running at http://localhost:${info.port}`);
});
