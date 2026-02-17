import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createParamMapper, type ParamMapDef } from "@codatum/embed";
import { type Context, Hono } from "hono";
import { type IssueTokenPayload, issueToken, loadConfig } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.json");

export const SCENARIO_ID = "scenario1";

interface Config {
  apiKey: string;
  apiSecret: string;
  integrationId: string;
  pageId: string;
  embedUrl: string;
  params: {
    tenant_id: ParamMapDef;
    store_id: ParamMapDef;
    date_range: ParamMapDef;
    product_category: ParamMapDef;
  };
}

function getTenantId(userId: string): string {
  return `tenant_${userId}`;
}

interface TokenRequestBody {
  tokenUserId: string;
}

const app = new Hono();

app.get("/config", (c: Context) => {
  const config = loadConfig<Config>(CONFIG_PATH);
  return c.json({
    embedUrl: config.embedUrl,
    params: {
      store_id: config.params.store_id,
      date_range: config.params.date_range,
      product_category: config.params.product_category,
    },
  });
});

app.post("/token", async (c: Context) => {
  const config = loadConfig<Config>(CONFIG_PATH);

  let body: TokenRequestBody;
  try {
    body = (await c.req.json()) as TokenRequestBody;
  } catch {
    return c.json({ message: "Invalid JSON body" }, 400);
  }
  const { tokenUserId } = body;
  if (!tokenUserId || typeof tokenUserId !== "string" || tokenUserId.trim() === "") {
    return c.json({ message: "tokenUserId is required" }, 400);
  }

  const tenantId = getTenantId(tokenUserId);
  const mapper = createParamMapper({
    tenant_id: config.params.tenant_id,
  });
  const encodedParams = mapper.encode({
    tenant_id: tenantId,
  });

  const payload: IssueTokenPayload = {
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    integration_id: config.integrationId,
    page_id: config.pageId,
    token_user_id: tokenUserId.trim(),
    params: encodedParams,
  };

  const { token } = await issueToken(payload);
  return c.json({ token });
});

export { app };
