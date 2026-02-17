# @codatum/embed

TypeScript library for embedding Codatum Notebook with [signed embed](https://docs.codatum.com/sharing/signed-embed). Use it in the browser to create the iframe, pass a token from your backend, and handle parameters and events. Server-side token issuance is out of scope.

- **Docs**: [Signed embed](https://docs.codatum.com/sharing/signed-embed) · [Integration](https://docs.codatum.com/sharing/signed-embed/integration) · [Use cases](https://docs.codatum.com/sharing/signed-embed/use-case)
- **Vue 3**: [@codatum/embed-vue](packages/embed-vue/README.md) — component wrapper for the core SDK

## Installation

```bash
pnpm add @codatum/embed
# or
npm install @codatum/embed
```

## Quick start

```ts
import { CodatumEmbed } from '@codatum/embed';

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: 'https://app.codatum.com/protected/workspace/xxx/notebook/yyy',
  tokenProvider: async () => {
    // Issue a token in your backend and fetch it here
    const res = await fetch('/api/codatum/token', { method: 'POST' });
    const data = await res.json();
    return { token: data.token };
  },
});

// cleanup
embed.destroy();
```

## API overview

### Initialization

**`CodatumEmbed.init(options: CodatumEmbedOptions): Promise<CodatumEmbedInstance>`**

Creates the iframe, waits for the iframe to be ready, gets a token and params from `tokenProvider`, and sends token (and optional params) to the iframe. Throws `CodatumEmbedError` on failure.

#### `CodatumEmbedOptions`

| Property | Required | Description |
|--------|----------|-------------|
| `container` | Yes | `HTMLElement` or CSS selector where the iframe is inserted |
| `embedUrl` | Yes | Signed embed URL from Codatum |
| `tokenProvider` | Yes | `() => Promise<{ token: string, params?: EncodedParam[] }>`. Called on `init()`, `reload()`, and on token auto-refresh. Returned `params` are sent to the embed with the token. |
| `iframeOptions` | No | See [IframeOptions](#iframeoptions) below |
| `tokenOptions` | No | See [TokenOptions](#tokenoptions) below |
| `displayOptions` | No | See [DisplayOptions](#displayoptions) below |

#### `IframeOptions`

Options applied to the iframe element and passed to the embed via URL/search params.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | `'LIGHT'` \| `'DARK'` | Browser's system theme | UI theme of the embedded notebook |
| `locale` | `string` | Browser's locale | Locale code (e.g. `'en'`, `'ja'`) for the embed UI |
| `className` | `string` | - | CSS class name(s) applied to the iframe element |
| `style` | `object` | `{width: '100%', height: '100%', border: 'none'}` | Inline styles for the iframe; overrides the default styles |

#### `TokenOptions`

Controls token lifetime, refresh behavior, and init timeout.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `refreshBuffer` | `number` | `60` | Seconds before expiry to trigger refresh |
| `retryCount` | `number` | `2` | Number of retries on token fetch failure; `0` = no retry |
| `initTimeout` | `number` | `30000` | Max wait in ms for embed "ready"; `0` = no timeout |
| `onRefreshError` | `(error: Error) => void` | `undefined` | Callback when `tokenProvider` fails after all retries |

#### `DisplayOptions`

Sent to the embed with the token.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sqlDisplay` | `'SHOW'` \| `'RESULT_ONLY'` \| `'HIDE'` | `'SHOW'` | Whether to show SQL Blocks, results only, or hide |
| `hideParamsForm` | `boolean` | `false` | Hide the parameter form in the embed (e.g. when your app owns the filters) |
| `expandParamsFormByDefault` | `boolean` | `false` | Whether the parameter form is expanded by default |

### Instance methods

| Method | Description |
|--------|-------------|
| `reload()` | Calls `tokenProvider` again and sends the returned token and params via `SET_TOKEN`. |
| `on(event, handler)` / `off(event, handler)` | Subscribe to `paramChanged` and `executeSqlsTriggered` (postMessage payloads from the iframe). |
| `destroy()` | Removes iframe, clears listeners and timers. No-op if already destroyed. |

### Instance properties

| Property | Type | Description |
|----------|------|-------------|
| `iframe` | `HTMLIFrameElement \| null` | The embed iframe element. |
| `status` | `'initializing' \| 'ready' \| 'destroyed'` | Current instance state. |

## ParamMapper

The embed talks in `param_id`s (IDs assigned per notebook parameter). Your app typically wants to work with meaningful keys like `store_id` or `date_range`. **ParamMapper** maps between your app’s key–value pairs and Codatum’s `param_id` + `param_value`, in both directions.

**Transformation (code-style)**

```ts
import { CodatumEmbed } from '@codatum/embed';

// Define mapping: your app’s key → Codatum param_id (and optional hidden/required)
const paramMapper = CodatumEmbed.createParamMapper({
  store_id: { paramId: '67a1b2c3d4e5f6a7b8c9d0e1' },
  date_range: { paramId: '67a1b2c3d4e5f6a7b8c9d0e2' },
  product_category: { paramId: '67a1b2c3d4e5f6a7b8c9d0e3' },
});

// Your app keeps state by meaningful keys:
const appState = {
  store_id: 'store_001',
  date_range: ['2025-01-01', '2025-01-31'],
  product_category: [],
};

// encode: app key:value → what the embed expects (param_id + param_value). Use in tokenProvider return.
paramMapper.encode(appState);
// → [
//   { param_id: '67a1b2c3...', param_value: '"store_001"' },
//   { param_id: '67a1b2c3...', param_value: '["2025-01-01","2025-01-31"]' },
//   { param_id: '67a1b2c3...', param_value: '[]' },
// ]

// decode: in paramChanged, payload.params is an array of { param_id, param_value } (same shape as encode output)
const payloadParams = [
  { param_id: '67a1b2c3...', param_value: '"store_001"' },
  { param_id: '67a1b2c3...', param_value: '["2025-01-01","2025-01-31"]' },
  { param_id: '67a1b2c3...', param_value: '[]' },
];
paramMapper.decode(payloadParams);
// → { store_id: 'store_001', date_range: [...], product_category: [] }
```

**Method details**

- **`encode(values)`** — Use when returning from `tokenProvider`. App key:value → `EncodedParam[]`; values are JSON-stringified into `param_value`. Throws `MISSING_REQUIRED_PARAM` if a key with `required: true` is missing. Use the sentinel `'_RESET_TO_DEFAULT_'` to reset a param to the notebook’s default.
- **`decode(params)`** — Use in `paramChanged` (and similar) handlers. `EncodedParam[]` (array of `{ param_id, param_value }`) → app key:value. `param_id`s not in `paramDefs` are ignored. Throws `MISSING_REQUIRED_PARAM` when a required param is missing, and `INVALID_PARAM_VALUE` for invalid JSON in `param_value`.

## Errors

All errors are thrown/rejected as `CodatumEmbedError` with `code`. Both `CodatumEmbed.init` and `ParamMapper` (encode/decode) can throw.

| Code | When |
|------|------|
| `CONTAINER_NOT_FOUND` | Container element not found at init |
| `INVALID_OPTIONS` | Init options are invalid |
| `INIT_TIMEOUT` | Ready not received within `tokenOptions.initTimeout` |
| `SESSION_PROVIDER_FAILED` | `tokenProvider` threw (init or reload) |
| `MISSING_REQUIRED_PARAM` | Required parameter missing (ParamMapper encode/decode) |
| `INVALID_PARAM_VALUE` | Invalid parameter value / JSON (ParamMapper decode) |

## Usage examples

### Basic (params form in embed)

```ts
const paramMapper = CodatumEmbed.createParamMapper({
  date_range: { paramId: '67a1b2c3d4e5f6a7b8c9d0e1' },
  product_category: { paramId: '67a1b2c3d4e5f6a7b8c9d0e2' },
  store_id: { paramId: '67a1b2c3d4e5f6a7b8c9d0e3' },
});

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: 'https://app.codatum.com/protected/workspace/xxx/notebook/yyy',
  iframeOptions: { theme: 'LIGHT', locale: 'ja', style: { height: '600px' } },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: currentUser.tenantId, store_id: currentUser.defaultStoreId }),
    });
    const data = await res.json();
    return {
      token: data.token,
      params: paramMapper.encode({
        date_range: '_RESET_TO_DEFAULT_',
        product_category: [],
        store_id: currentUser.defaultStoreId,
      }),
    };
  },
  tokenOptions: {
    refreshBuffer: 300,
    onRefreshError: () => { window.location.href = '/login'; },
  },
});

embed.on('paramChanged', (payload) => {
  const values = paramMapper.decode(payload.params);
  console.log('Changed:', values);
});
```

### Client-side params only (SaaS manages filters, hide params form)

```ts
let currentStoreId = 'store_001';
let currentDateRange: [string, string] = ['2025-01-01', '2025-01-31'];

const paramMapper = CodatumEmbed.createParamMapper({
  store_id: { paramId: '67a1b2c3d4e5f6a7b8c9d0e1', hidden: true },
  date_range: { paramId: '67a1b2c3d4e5f6a7b8c9d0e2' },
  product_category: { paramId: '67a1b2c3d4e5f6a7b8c9d0e3' },
});

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  iframeOptions: { theme: 'LIGHT', locale: 'ja' },
  displayOptions: { hideParamsForm: true },
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', { method: 'POST', ... });
    const data = await res.json();
    return {
      token: data.token,
      params: paramMapper.encode(
        { store_id: currentStoreId, date_range: currentDateRange, product_category: [] },
      ),
    };
  },
});

async function onFilterChange(storeId: string, dateRange: [string, string]) {
  currentStoreId = storeId;
  currentDateRange = dateRange;
  await embed.reload(); // tokenProvider is called again with current closure values
}
```

### Server-side parameter change (token re-issue)

```ts
let currentStoreId = 'store_001';
const paramMapper = CodatumEmbed.createParamMapper({
  store_id: { paramId: '67a1b2c3d4e5f6a7b8c9d0e1', hidden: true },
  date_range: { paramId: '67a1b2c3d4e5f6a7b8c9d0e2' },
  product_category: { paramId: '67a1b2c3d4e5f6a7b8c9d0e3' },
});
let latestValues = paramMapper.decode([]);

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  tokenProvider: async () => {
    const res = await fetch('/api/codatum/token', {
      method: 'POST',
      body: JSON.stringify({ tenant_id: currentUser.tenantId, store_id: currentStoreId }),
    });
    const data = await res.json();
    return {
      token: data.token,
      params: paramMapper.encode({
        date_range: '_RESET_TO_DEFAULT_',
        product_category: [],
        store_id: currentStoreId,
      }),
    };
  },
});

embed.on('paramChanged', (payload) => { latestValues = paramMapper.decode(payload.params); });

async function onStoreSwitch(storeId: string) {
  currentStoreId = storeId;
  await embed.reload(); // tokenProvider returns new token + params for the new store
}
```

### Multiple notebooks

```ts
const [salesDashboard, supportDashboard] = await Promise.all([
  CodatumEmbed.init({
    container: '#sales',
    embedUrl: 'https://app.codatum.com/.../notebook/aaa',
    tokenProvider: () => fetchSession('aaa'), // returns { token, params? }
  }),
  CodatumEmbed.init({
    container: '#support',
    embedUrl: 'https://app.codatum.com/.../notebook/bbb',
    tokenProvider: () => fetchSession('bbb'),
  }),
]);
```

## CDN

```html
<script src="https://unpkg.com/@codatum/embed/dist/index.global.min.js"></script>
<script>
  CodatumEmbed.init({ container: '#dashboard', embedUrl: '...', tokenProvider: async () => ({ token: '...' }) });
</script>
```

## Security and deployment

- **CSP**: If your app sets Content-Security-Policy, allow `frame-src https://app.codatum.com`.
- **iframe**: The SDK sets `allow="fullscreen; clipboard-write"` on the iframe. Styling defaults to 100% width/height; override with `iframeOptions.style`.

## Supported environments

- Browsers: ES2017+ (Chrome 63+, Firefox 57+, Safari 12+, iOS Safari 12+)
- Module formats: ESM, CJS, IIFE (see CDN)

## Contributing

Setup, build, test, and package layout: [CONTRIBUTING.md](CONTRIBUTING.md).
