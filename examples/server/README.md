# Examples server

A small Hono-based server that issues Codatum signed-embed tokens. Used by the vanilla (and other) examples so the frontend can get an `embedUrl` and tokens without handling API credentials in the browser.

## Setup

1. Copy the config template and fill in your credentials:

   ```bash
   cp config.example.json config.json
   ```

2. Edit `config.json` with values from your Codatum workspace:

   - **apiKey** / **apiSecret**: From **Workspace settings → API Keys** (create a key if needed).
   - **integrationId** / **pageId**: From the signed-embed setup for the notebook (see [Codatum signed-embed docs](https://docs.codatum.com/sharing/signed-embed/integration)).
   - **embedUrl**: The signed-embed URL for the notebook (e.g. `https://app.codatum.com/protected/workspace/xxx/notebook/yyy`).

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
| GET    | /config | Returns `{ embedUrl }` for the frontend. |
| POST   | /token  | Issues a token. Body: `{ tokenUserId: string, params?: Array<{ param_id, param_value }> }`. Returns `{ token }`. |

CORS is allowed from any origin (for local development only).
