import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createParamMapper, type ParamMapDef } from "@codatum/embed";
import { type Context, Hono } from "hono";
import { type IssueTokenPayload, issueToken, loadConfig } from "../utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.jsonc");

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

interface TokenRequestBody {
  tokenUserId: string;
}

const app = new Hono();

app.get("/config", (c: Context) => {
  const config = loadConfig<Config>(CONFIG_PATH);
  return c.json(config);
});

app.post("/token", async (c: Context) => {
  const config = loadConfig<Config>(CONFIG_PATH);

  let body: TokenRequestBody;
  try {
    body = (await c.req.json()) as TokenRequestBody;
  } catch {
    throw new Error("Invalid JSON body");
  }
  const { tokenUserId } = body;
  if (!tokenUserId || typeof tokenUserId !== "string" || tokenUserId.trim() === "") {
    throw new Error("tokenUserId is required");
  }

  const tenantId = `tenant_${tokenUserId}`;
  const mapper = createParamMapper(config.params);

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
