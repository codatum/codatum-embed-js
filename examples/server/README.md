# Examples server

A small Hono-based server that issues Codatum signed-embed tokens. Used by the vanilla (and other) examples so the frontend can get an `embedUrl` and tokens without handling API credentials in the browser.

## Setup

1. Prepare your Codatum workspace and notebook:

   - Create API Key in **Workspace settings → API Keys**, and get **apiKey** and **apiSecret**.
   - Create notebook with parameters as follows:
     - **tenant_id**: string
     - **store_id**: string
     - **date_range**: [string, string]
     - **product_category**: string
   - Publish the notebook as signed-embed.
   - Configure server-side parameters as follows:
     - **tenant_id**: Fixed value for a server-side parameter
   - Get **integrationId** and **pageId** from the signed-embed setup for the notebook (see [Codatum signed-embed docs](https://docs.codatum.com/sharing/signed-embed/integration)).

2. Copy the config template and fill in your credentials:

   ```bash
   cp config.example.json config.json
   ```

3. Edit `config.json` with values from your Codatum workspace:

   - **apiKey** / **apiSecret**: From **Workspace settings → API Keys** (create a key if needed).
   - **integrationId** / **pageId**: From the signed-embed setup for the notebook (see [Codatum signed-embed docs](https://docs.codatum.com/sharing/signed-embed/integration)).
   - **embedUrl**: The signed-embed URL for the notebook (e.g. `https://app.codatum.com/protected/workspace/xxx/notebook/yyy`).
   - **params**: Fill `paramId` for each parameter.

`config.json` is gitignored; do not commit it.

## Run

From the repo root:

```bash
pnpm --filter @examples/server dev
```

The server listens on **http://localhost:3100**.

## Endpoints

| Method | Path    | Description |
|--------|---------|-------------|
| GET    | /config | Returns `{ embedUrl, params }` for the frontend. |
| POST   | /token  | Issues a token. Body: `{ tokenUserId: string }`. Returns `{ token }`. |

CORS is allowed from any origin (for local development only).
