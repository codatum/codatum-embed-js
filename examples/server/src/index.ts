import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";

const CONFIG_PATH = join(process.cwd(), "config.json");
const CODATUM_ISSUE_TOKEN_URL = "https://api.codatum.com/api/notebook/issueToken";
const PORT = 3100;

interface Config {
  apiKey: string;
  apiSecret: string;
  integrationId: string;
  pageId: string;
  embedUrl: string;
}

function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    console.error(
      "config.json not found. Copy config.example.json to config.json and set your credentials.",
    );
    process.exit(1);
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as Config;
}

const config = loadConfig();

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/config", (c: Context) => {
  return c.json({ embedUrl: config.embedUrl });
});

interface TokenRequestBody {
  tokenUserId: string;
  params?: Array<{ param_id: string; param_value: string }>;
}

app.post("/token", async (c: Context) => {
  let body: TokenRequestBody;
  try {
    body = (await c.req.json()) as TokenRequestBody;
  } catch {
    return c.json({ message: "Invalid JSON body" }, 400);
  }
  const { tokenUserId, params } = body;
  if (!tokenUserId || typeof tokenUserId !== "string" || tokenUserId.trim() === "") {
    return c.json({ message: "tokenUserId is required" }, 400);
  }

  const payload = {
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    integration_id: config.integrationId,
    page_id: config.pageId,
    token_user_id: tokenUserId.trim(),
    params: params ?? [],
  };

  const res = await fetch(CODATUM_ISSUE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as { token?: string; message?: string };
  if (!res.ok) {
    const status = res.status as 400 | 401 | 403 | 404 | 422 | 500;
    return c.json({ message: data.message ?? "Failed to issue token" }, status);
  }
  if (!data.token) {
    return c.json({ message: "No token in response" }, 500);
  }
  return c.json({ token: data.token });
});

serve({ fetch: app.fetch, port: PORT }, (info: { port: number }) => {
  console.log(`Examples server running at http://localhost:${info.port}`);
  console.log("  GET  /config - embed URL for frontend");
  console.log("  POST /token  - issue signed embed token");
});
