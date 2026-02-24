import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createParamMapper } from "@codatum/embed";
import { type Context, Hono } from "hono";
import { getStoreIdsByTenantId, getTenantIdByUserId, getUserId } from "../scenarioUtils";
import { getIntegrationId, type IssueTokenPayload, issueToken, loadConfig } from "../utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.jsonc");

interface Config {
  apiKey: string;
  apiSecret: string;
  apiOrigin: string;
  pageId: string;
  embedUrl: string;
  paramMapping: {
    tenant_id: string;
    store_id: string;
    date_range: string;
    product_category: string;
  };
}

interface TokenRequestBody {
  tokenUserId: string;
  params?: {
    store_id?: string;
  };
}

const app = new Hono();

app.get("/config", async (c: Context) => {
  const config = loadConfig<Config>(CONFIG_PATH);
  const userId = getUserId();
  const tenantId = await getTenantIdByUserId(userId);
  const storeIds = await getStoreIdsByTenantId(tenantId);
  return c.json({
    embedUrl: config.embedUrl,
    paramMapping: config.paramMapping,
    userId: getUserId(),
    storeIds,
  });
});

app.post("/token", async (c: Context) => {
  const config = loadConfig<Config>(CONFIG_PATH);

  let body: TokenRequestBody;
  try {
    body = (await c.req.json()) as TokenRequestBody;
  } catch {
    throw new Error("Invalid JSON body");
  }
  const { tokenUserId, params } = body;
  if (!tokenUserId || typeof tokenUserId !== "string" || tokenUserId.trim() === "") {
    throw new Error("tokenUserId is required");
  }

  const tenantId = await getTenantIdByUserId(tokenUserId);
  const storeIds = await getStoreIdsByTenantId(tenantId);
  const storeId = params?.store_id ?? storeIds[0];

  // validate storeId
  if (!storeIds.includes(storeId)) {
    throw new Error("Invalid storeId");
  }

  const mapper = createParamMapper(config.paramMapping, {
    tenant_id: { datatype: "STRING", required: true },
    store_id: { datatype: "STRING", required: true },
  });
  const encodedParams = mapper.encode({
    tenant_id: tenantId,
    store_id: storeId,
  });

  const payload: IssueTokenPayload = {
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    integration_id: getIntegrationId(config.embedUrl),
    page_id: config.pageId,
    token_user_id: tokenUserId.trim(),
    params: encodedParams,
  };

  const { token } = await issueToken(config.apiOrigin, payload);
  return c.json({ token });
});

export { app };
