# @codatum/embed

Core TypeScript SDK for embedding Codatum Notebook with [signed embed](https://docs.codatum.com/sharing/signed-embed): create the iframe in the browser, pass a token from your backend, handle parameters and events. Server-side token issuance is out of scope.

**Docs**: [Signed embed](https://docs.codatum.com/sharing/signed-embed) · [Integration](https://docs.codatum.com/sharing/signed-embed/integration) · [Use cases](https://docs.codatum.com/sharing/signed-embed/use-case). **Wrappers**: [@codatum/embed-react](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed-react#readme), [@codatum/embed-vue](https://github.com/codatum/codatum-embed-js/tree/main/packages/embed-vue#readme).

## Installation

```bash
pnpm add @codatum/embed
# or
npm install @codatum/embed
```

## Quick start

```ts
import { createEmbed } from '@codatum/embed';

const embed = createEmbed({
  container: '#dashboard',
  embedUrl: 'https://app.codatum.com/protected/workspace/xxx/notebook/yyy',
  tokenProvider: async () => {
    // Issue a token in your backend and fetch it here
    const res = await fetch('/api/codatum/token', { method: 'POST' });
    const data = await res.json();
    return { token: data.token };
  },
});
await embed.init();

// cleanup
embed.destroy();
```

## Embed

### `EmbedOptions`

| Property | Required | Description |
|--------|----------|-------------|
| `container` | Yes | `HTMLElement` or CSS selector where the iframe is inserted |
| `embedUrl` | Yes | Signed embed URL from Codatum |
| `tokenProvider` | Yes | See [tokenProvider](#tokenprovider) below |
| `iframeOptions` | No | See [IframeOptions](#iframeoptions) below |
| `tokenOptions` | No | See [TokenOptions](#tokenoptions) below |
| `displayOptions` | No | See [DisplayOptions](#displayoptions) below |
| `devOptions` | No | See [DevOptions](#devoptions) below |

#### `tokenProvider`

Required callback that issues a token from your backend and returns it (and optionally `params`). Called on `init()`, `reload()`, and when the token is about to expire (unless `tokenOptions.disableRefresh` is `true`).

**Signature:** `(context: TokenProviderContext) => Promise<{ token: string; params?: EncodedParam[] }>`

- **`context.trigger`** — `'INIT'` | `'RELOAD'` | `'REFRESH'`.
- **`context.markNonRetryable()`** — Call on failure to skip retries (ignores `tokenOptions.retryCount`).
- **`params`** — Optional. If returned, sent to the embed with the token; use [ParamMapper](#parammapper) `encode()` to build.

**Example:**

```ts
tokenProvider: async (context) => {
  const res = await fetch('/api/codatum/token', {
    method: 'POST',
    body: JSON.stringify({ tenant_id: currentUser.tenantId }),
  });
  if (!res.ok) {
    if (res.status === 401) context.markNonRetryable();
    throw new Error(`Token failed: ${res.status}`);
  }
  const data = await res.json();
  const params = paramMapper.encode({ 
    store_id: currentUser.defaultStoreId,
    date_range: ['2025-01-01', '2025-01-31']
  });
  return { token: data.token, params };
}
```

#### `IframeOptions`

Options applied to the iframe element and passed to the embed via URL/search params.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | `'LIGHT'` \| `'DARK'`\| `'SYSTEM'` | `'SYSTEM'` | UI theme of the embedded notebook |
| `locale` | `string` | Browser's locale | Locale code (e.g. `'en'`, `'ja'`) for the embed UI |
| `className` | `string` | - | CSS class name(s) applied to the iframe element |
| `style` | `object` | `{display: 'block', width: '100%', height: '100%', border: 'none'}` | Inline styles for the iframe; overrides the default styles |
| `attrs` | `Record<string, string>` | - | Additional HTML attributes for the iframe (e.g. `{ title: 'Dashboard', 'data-testid': 'embed-iframe' }`) |

#### `TokenOptions`

Controls token lifetime, refresh behavior, and loading timeout.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `disableRefresh` | `boolean` | `false` | When `true`, disables automatic token refresh before the token expires |
| `refreshBuffer` | `number` | `60` | Number of seconds before the token expires when auto-refresh is triggered |
| `retryCount` | `number` | `2` | Number of retries on token fetch failure; `0` = no retry |
| `loadingTimeout` | `number` | `30` | Max wait in seconds for `CONTENT_READY` after entering `INITIALIZING`, `RELOADING`, or `REFRESHING`; `0` = no timeout |
| `onRefreshError` | `(error: EmbedError) => void` | `undefined` | Callback invoked when token auto-refresh fails (due to `tokenProvider` failure or loading timeout) and does not recover after all retries |

#### `DisplayOptions`

Sent to the embed with the token.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sqlDisplay` | `'SHOW'` \| `'RESULT_ONLY'` \| `'HIDE'` | `'SHOW'` | Whether to show SQL Blocks, results only, or hide |
| `hideParamsForm` | `boolean` | `false` | Hide the parameter form in the embed (e.g. when your app owns the filters) |
| `expandParamsFormByDefault` | `boolean` | `false` | Whether the parameter form is expanded by default |

#### `DevOptions`

Development and testing only. Not intended for production.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `debug` | `boolean` | `false` | When `true`, logs SDK lifecycle: postMessage (in/out), tokenProvider calls/refresh/retries, status transitions. |
| `disableValidateUrl` | `boolean` | `false` | When `true`, skips `embedUrl` format validation (domain/path). Use for local or staging URLs that don't match the production pattern. |
| `mock` | `boolean` \| `MockOptions` | - | Enables mock mode: no real embed load, no network. iframe uses `srcdoc` with a styled placeholder. |

**MockOptions** (when `mock` is an object):

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | `string` | `embedUrl` | Text shown in the mock iframe placeholder. Useful when multiple embeds are on the page. |
| `callTokenProvider` | `boolean` | `false` | When `true`, calls `tokenProvider` on `init()`, `reload()`, and auto-refresh. |

### Creating an embed instance

**`createEmbed(options: EmbedOptions): EmbedInstance`**

Creates an embed instance. Throws `EmbedError` if options are invalid. Call `init()` to create the iframe and start the token flow.

### Instance methods

| Method | Description |
|--------|-------------|
| `async init()` | Creates the iframe, waits for it to be ready, calls `tokenProvider`, and sends token (and optional params) to the embed. Resolves when the embed sends `CONTENT_READY`. Rejects with `EmbedError` on failure. |
| `async reload()` | Calls `tokenProvider`, sends the returned token and params via `SET_TOKEN`, and resolves when the embed sends `CONTENT_READY`. Rejects with `EmbedError` on failure. |
| `destroy()` | Removes iframe, clears listeners and timers. No-op if already destroyed. |

### Instance properties

| Property | Type | Description |
|----------|------|-------------|
| `iframe` | `HTMLIFrameElement \| null` | The embed iframe element. |
| `status` | `'CREATED' \| 'INITIALIZING' \| 'RELOADING' \| 'REFRESHING' \| 'READY' \| 'DESTROYED'` | Current instance state. |

### Container attribute

The SDK sets a `data-codatum-embed-status` attribute on the container element, reflecting the current status. The attribute is added when `init()` is called and removed on `destroy()`. Use it for CSS-based styling or E2E test selectors.

| Status | When |
|--------|------|
| `INITIALIZING` | `init()` called, waiting for content |
| `READY` | Content loaded and visible |
| `RELOADING` | `reload()` called, waiting for content |
| `REFRESHING` | Auto-refresh in progress |
| `DESTROYED` | (attribute removed) |

#### Example: Custom loading UI

Show your own loading indicator during initialization while keeping the iframe hidden:
```html
<div id="dashboard" style="position: relative;">
  <div class="my-loading">Loading…</div>
</div>
```
```css
/* Hide iframe and show loading UI while loading */
[data-codatum-embed-status="INITIALIZING"] iframe,
[data-codatum-embed-status="RELOADING"] iframe,
[data-codatum-embed-status="REFRESHING"] iframe {
  visibility: hidden;
}
[data-codatum-embed-status="INITIALIZING"] .my-loading,
[data-codatum-embed-status="RELOADING"] .my-loading,
[data-codatum-embed-status="REFRESHING"] .my-loading {
  display: flex;
  position: absolute;
  inset: 0;
  align-items: center;
  justify-content: center;
}

/* Hide loading UI when ready */
[data-codatum-embed-status="READY"] .my-loading {
  display: none;
}
```

Without any custom CSS, the embed's built-in loading screen is shown as-is inside the iframe.

### Events

Subscribe with `on(event, handler)` and `off(event, handler)`.

| Event | Description | Payload |
|-------|-------------|---------|
| `statusChanged` | Instance status changed. | `{ type: 'STATUS_CHANGED', status: EmbedStatus, previousStatus: EmbedStatus }` |
| `paramChanged` | User changed parameters in the embed. | `{ type: 'PARAM_CHANGED', params: EncodedParam[] }` |
| `executeSqlsTriggered` | SQL execution was triggered in the embed. | `{ type: 'EXECUTE_SQLS_TRIGGERED', params: EncodedParam[] }` |

Decode with `ParamMapper.decode(payload.params)`. `EncodedParam`: see [ParamMapper](#parammapper).

## ParamMapper

The embed uses `param_id`s (IDs assigned per notebook parameter). Your app typically works with meaningful keys such as `store_id` or `date_range`. **ParamMapper** maps between your app's key–value pairs and Codatum's `param_id` + `param_value` in both directions.

### Basic usage

```ts
import { createParamMapper } from '@codatum/embed';

const paramMapper = createParamMapper({
  store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
  date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
});

const appState = {
  store_id: 'store_001',
  date_range: ['2025-01-01', '2025-01-31'],
  product_category: ['Electronics'],
};

// encode: app key:value → EncodedParam[] (use in tokenProvider return)
paramMapper.encode(appState);
// → [
//   { param_id: '67a1b2c3...', param_value: '"store_001"' },
//   { param_id: '67a1b2c3...', param_value: '["2025-01-01","2025-01-31"]' },
//   { param_id: '67a1b2c3...', param_value: '["Electronics"]' },
// ]

// decode: EncodedParam[] → app key:value (use in paramChanged / executeSqlsTriggered)
paramMapper.decode(payload.params);
// → { store_id: 'store_001', date_range: [...], product_category: ['Electronics'] }
```

### Creating a mapper

**`createParamMapper(mapping, meta?)`**

| Argument | Type | Description |
|----------|------|-------------|
| `mapping` | `Record<string, string>` | Your app's key → Codatum `param_id` for each parameter. |
| `meta` | `Record<key, ParamMeta>` (optional) | Same keys as `mapping`. Per-key options: `hidden`, `required`, `datatype`. |

**`ParamMeta`** (optional, per key):

| Property | Type | Description |
|----------|------|-------------|
| `datatype` | `ParamDatatype` | Enables validation and improves typing. See [Param datatypes](#param-datatypes) below. |
| `required` | `boolean` | If `true`, `encode` and `decode` throw `MISSING_REQUIRED_PARAM` when the param is missing. |
| `hidden` | `boolean` | If `true`, encoded params include `is_hidden: true` so the embed can hide them from the params form. |

#### Param datatypes

When `meta[key].datatype` is set, `encode` and `decode` validate values. Supported values:

| `ParamDatatype` | JS/TS type | Notes |
|-----------------|------------|--------|
| `'STRING'` | `string` | — |
| `'NUMBER'` | `number` | Rejects `NaN`. |
| `'BOOLEAN'` | `boolean` | — |
| `'DATE'` | `string` | Must be `YYYY-MM-DD`. |
| `'STRING[]'` | `string[]` | Array of strings. |
| `'[DATE, DATE]'` | `[string, string]` | Date range; both elements must be `YYYY-MM-DD`. |

### Instance methods

| Method | Description |
|--------|-------------|
| **`encode(values, options?)`** | App key:value → `EncodedParam[]`. JSON-stringifies values. Use `RESET_TO_DEFAULT` as a value to reset that param to the notebook's default.
| **`decode(params, options?)`** | `EncodedParam[]` → app key:value. Ignores params not in mapping. |

#### `encode` / `decode` options

Both methods accept an optional second argument:

| Option | Type | Description |
|--------|------|-------------|
| `only` | `(keyof mapping)[]` | Limit to these keys. Useful when the host sends only a subset (e.g. server sends some params; client sends the rest via `encode` with `only`). |
| `noValidate` | `boolean` | When `true`, skips required and datatype validation. |

### Type-first usage

When you define parameter definitions (e.g. with `datatype`) and want typed encode/decode, you can use the helper types.

```ts
import { createParamMapper, RESET_TO_DEFAULT, type DefineDecodedParams, type EncodedParam } from '@codatum/embed';

const paramDefs = {
  store_id: { datatype: 'STRING', required: true },
  date_range: { datatype: '[DATE, DATE]' },
  product_category: { datatype: 'STRING[]' },
} as const;

type ParamValues = DefineDecodedParams<typeof paramDefs>;
// → { store_id: string, date_range?: [string, string], product_category?: string[] }

const paramValues: ParamValues = {
  store_id: 'store_001',
  date_range: RESET_TO_DEFAULT,
  product_category: ['Electronics']
};

const paramMapper = createParamMapper({
  store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
  date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
}, paramDefs);

// encode only the date_range and product_category params for client-side params
const clientParams = paramMapper.encode(paramValues, { only: ['date_range', 'product_category'] })
// → [
//   { param_id: '67a1b2c3d4e5f6a7b8c9d0e2', param_value: '["2025-01-01","2025-01-31"]' },
//   { param_id: '67a1b2c3d4e5f6a7b8c9d0e3', param_value: '["Electronics"]' },
// ]

const onParamChanged = (ev: { params: EncodedParam[] }) => {
  const values: ParamValues = paramMapper.decode(ev.params);
  console.log('Changed:', values);
};
```

## Errors

All errors are thrown/rejected as `EmbedError` with a `code` property.

| Code | Thrown by | Description |
|------|----------|-------------|
| `INVALID_OPTIONS` | `createEmbed` | Options are invalid |
| `CONTAINER_NOT_FOUND` | `init` | Container element not found |
| `LOADING_TIMEOUT` | `init` / `reload` | `CONTENT_READY` not received within `tokenOptions.loadingTimeout`; auto-refresh reports via `onRefreshError` |
| `TOKEN_PROVIDER_FAILED` | `init` / `reload` | `tokenProvider` threw |
| `MISSING_REQUIRED_PARAM` | `encode` / `decode` | Required param missing |
| `INVALID_PARAM_VALUE` | `encode` / `decode` | Value failed validation |
| `UNEXPECTED_ERROR` | `createEmbed` / `init` / `reload` | Unexpected error |

### Error handling

`init()` and `reload()` throw on failure — handle with try/catch. Auto-refresh errors are delivered via the `tokenOptions.onRefreshError` callback.
```ts
import { createEmbed, EmbedError } from '@codatum/embed';

try {
  const embed = createEmbed({
    container: '#dashboard',
    embedUrl: '...',
    tokenProvider: async () => { /* ... */ },
    tokenOptions: {
      onRefreshError: (error) => {
        // Token auto-refresh failed after all retries.
        // e.g. redirect to login, show a banner, etc.
        console.error('Refresh failed:', error);
      },
    },
  });
  await embed.init();

  // reload() also throws on failure
  await embed.reload();
} catch (error) {
  if (error instanceof EmbedError) {
      // error.cause holds the original error thrown by tokenProvider (if applicable)
    console.error(error.code, error.message);
  }
}
```

## Usage examples

The following patterns demonstrate common integration scenarios as outlined in the [Signed embed use cases](https://docs.codatum.com/sharing/signed-embed/use-case).

### Example A: Params form in embed (server validates store, client sends filters)

Embed shows the notebook's parameter form. The server validates `store_id` and encodes it in the token; the client sends current `store_id` on each token request and encodes only `date_range` and `product_category` as client-side params so the form and host stay in sync.

**Client**

```ts
import { createEmbed, createParamMapper, RESET_TO_DEFAULT } from '@codatum/embed';

const paramMapper = createParamMapper({...}, {
  store_id: { datatype: 'STRING' },  // server-side param
  date_range: { datatype: '[DATE, DATE]' },  // client-side param
  product_category: { datatype: 'STRING[]' },  // client-side param
});
let paramValues = { store_id: undefined, date_range: RESET_TO_DEFAULT, product_category: [] };

const embed = createEmbed({
  container: '#dashboard',
  embedUrl: '...',
  displayOptions: { expandParamsFormByDefault: true },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      body: JSON.stringify({ tokenUserId: userId, params: { store_id: paramValues.store_id } }),
    });
    const { token } = await res.json();
    const params = paramMapper.encode(paramValues, { only: ['date_range', 'product_category'] });
    return { token, params };
  },
});
await embed.init();

embed.on('paramChanged', (ev) => { paramValues = paramMapper.decode(ev.params); });
embed.on('executeSqlsTriggered', (ev) => { paramValues = paramMapper.decode(ev.params); });
```

**Server** — Validate `store_id` against the tenant and encode it in the token:

```ts
import { createParamMapper } from '@codatum/embed';

// POST /token body: { tokenUserId, params?: { store_id } }
const paramMapper = createParamMapper({...}, {
  tenant_id: { datatype: 'STRING', required: true },  // server-side param
  store_id: { datatype: 'STRING', required: true },  // server-side param
});
const tenantId = await getTenantIdByUserId(tokenUserId);
const storeIdsForTenant = await getStoreIdsByTenantId(tenantId);
const storeId = params?.store_id ?? storeIdsForTenant[0];
if (!storeIdsForTenant.includes(storeId)) throw new Error('Invalid storeId');
const encoded = paramMapper.encode({ tenant_id: tenantId, store_id: storeId });
// issue token with encoded params
```

### Example B: Client-side params only (SaaS owns filters, hide params form)

All parameters except `tenant_id` are managed by the host; the embed's parameter form is hidden. The token carries only tenant context, so it can be cached and reused. When the user changes filters in the host UI, call `reload()` so the token provider runs again with updated values.

**Client**

```ts
import { createEmbed, createParamMapper } from '@codatum/embed';

const paramMapper = createParamMapper({...}, {
  store_id: { datatype: 'STRING' },  // client-side param
  date_range: { datatype: '[DATE, DATE]' },  // client-side param
  product_category: { datatype: 'STRING[]' },  // client-side param
});
let paramValues = { store_id: 'store_001', date_range: ['2025-01-01', '2025-01-31'], product_category: [] };

const embed = createEmbed({
  container: '#dashboard',
  embedUrl: '...',
  displayOptions: { hideParamsForm: true },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', { method: 'POST', body: JSON.stringify({ tokenUserId: userId }) });
    const { token } = await res.json();
    const params = paramMapper.encode(paramValues);
    return { token, params };
  },
});
await embed.init();

embed.on('paramChanged', (ev) => { paramValues = paramMapper.decode(ev.params); });
embed.on('executeSqlsTriggered', (ev) => { paramValues = paramMapper.decode(ev.params); });

// When the user changes filters in the host UI, update paramValues and reload the embed
async function onDashboardFilterChange(newValues: ParamValues) {
  paramValues = newValues;
  await embed.reload();
}
```

**Server** — Token needs only tenant scope (no param in body):

```ts
import { createParamMapper } from '@codatum/embed';

// POST /token body: { tokenUserId }
const paramMapper = createParamMapper({...}, {
  tenant_id: { datatype: 'STRING', required: true },  // server-side param
});
const tenantId = await getTenantIdByUserId(tokenUserId);
const encoded = paramMapper.encode({ tenant_id: tenantId });
// issue token with encoded params
```

### Example C: Server-side store (token re-issue on store change)

`store_id` is fixed in the token and validated server-side; changing the store requires a new token. The params form is visible for `date_range` and `product_category`. Keep latest param values from `paramChanged` and pass `store_id` to the server on each token request; when the user switches store, reload so a new token is issued for the new store.

**Client**

```ts
import { createEmbed, createParamMapper, RESET_TO_DEFAULT } from '@codatum/embed';

const paramMapper = createParamMapper({...}, {
  store_id: { datatype: 'STRING' },  // server-side param
  date_range: { datatype: '[DATE, DATE]' },  // client-side param
  product_category: { datatype: 'STRING[]' },  // client-side param
});
let paramValues = { store_id: undefined, date_range: RESET_TO_DEFAULT, product_category: ['Electronics'] };

const embed = createEmbed({
  container: '#dashboard',
  embedUrl: '...',
  displayOptions: { expandParamsFormByDefault: true },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      body: JSON.stringify({ tokenUserId: userId, params: { store_id: paramValues.store_id } }),
    });
    const { token } = await res.json();
    const params = paramMapper.encode(paramValues, { only: ['date_range', 'product_category'] });
    return { token, params };
  },
});
await embed.init();

embed.on('paramChanged', (ev) => { paramValues = paramMapper.decode(ev.params); });
embed.on('executeSqlsTriggered', (ev) => { paramValues = paramMapper.decode(ev.params); });

async function onStoreSwitch(storeId: string) {
  paramValues.store_id = storeId;
  await embed.reload();
}
```

**Server** — Same as Example A: accept `params.store_id`, validate, encode `tenant_id` + `store_id` in the token.

## CDN

A separate IIFE build exposes a single global `CodatumEmbed`. Load the script and use `CodatumEmbed.createEmbed` then `embed.init()`.

```html
<script src="https://unpkg.com/@codatum/embed/dist/index.global.min.js"></script>
<script>
  (async function () {
    const embed = CodatumEmbed.createEmbed({ container: '#dashboard', embedUrl: '...', tokenProvider: ... });
    await embed.init();
  })();
</script>
```

## See also

- **Versioning and changelog**: [Versioning](https://github.com/codatum/codatum-embed-js#versioning)
- **Security and deployment**: [Security and deployment](https://github.com/codatum/codatum-embed-js#security-and-deployment)
- **Supported environments**: [Supported environments](https://github.com/codatum/codatum-embed-js#supported-environments)
