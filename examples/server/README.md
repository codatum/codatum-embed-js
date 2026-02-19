# Examples server

A small Hono-based server that issues Codatum signed-embed tokens. Used by the vanilla (and other) examples so the frontend can get an `embedUrl` and tokens without handling API credentials in the browser.

The server exposes multiple **scenarios** (e.g. scenario1, scenario2, scenario3). Each scenario is mounted under its own path and uses its own config file.

## Setup

1. Prepare your Codatum workspace and notebook:

   - Create API Key in **Workspace settings → API Keys**, and get **apiKey** and **apiSecret**.
   - Create notebook with parameters as follows:
     - **tenant_id**: string
     - **store_id**: string
     - **date_range**: [string, string]
     - **product_category**: string
   - Publish the notebook as signed-embed.
   - Configure server-side parameters as appropriate for the scenario (e.g. fixed value for **tenant_id** where required).
   - Get **embedUrl** and **pageId** from the signed-embed setup for the notebook (see [Codatum signed-embed docs](https://docs.codatum.com/sharing/signed-embed/integration)).

2. **Per scenario**, add a config file using the example as reference:

   - Config is loaded as `config.jsonc` from each scenario directory (e.g. `src/scenarios/scenario1/config.jsonc`).
   - For each scenario you use, copy the scenario’s `config.example.jsonc` to `config.jsonc` in that same directory and fill in your credentials:

   ```bash
   cp src/scenarios/scenario1/config.example.jsonc src/scenarios/scenario1/config.jsonc
   # repeat for scenario2, scenario3, etc. as needed
   ```

3. Edit each `config.jsonc` with values from your Codatum workspace:

   - **apiKey** / **apiSecret**: From **Workspace settings → API Keys** (create a key if needed).
   - **pageId**: From the signed-embed setup for the notebook (see [Codatum signed-embed docs](https://docs.codatum.com/sharing/signed-embed/integration)).
   - **embedUrl**: The signed-embed URL for the notebook (e.g. `https://app.codatum.com/protected/workspace/xxx/notebook/yyy`).
   - **paramMapping**: Fill each parameter ID (e.g. `tenant_id`, `store_id`, `date_range`, `product_category`) with the corresponding param IDs from your notebook’s signed-embed setup. Comments in `config.example.jsonc` indicate server-side vs client-side parameters.

`config.jsonc` is gitignored; do not commit it.

## Run

From the repo root:

```bash
pnpm --filter @examples/server dev
```

The server listens on **http://localhost:3100**.

## Endpoints

Each scenario is served under its base path (e.g. `/scenario1`, `/scenario2`, `/scenario3`). For a given scenario:

| Method | Path (per scenario) | Description |
|--------|----------------------|-------------|
| GET    | `/<scenario>/config` | Returns `{ embedUrl, paramMapping, userId, ... }` for the frontend. |
| POST   | `/<scenario>/token`  | Issues a token. Body: `{ tokenUserId: string, params?: { ... } }`. Returns `{ token }`. |

Example: `GET http://localhost:3100/scenario1/config`, `POST http://localhost:3100/scenario1/token`.

CORS is allowed from any origin (for local development only).
