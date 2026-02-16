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

Creates the iframe, waits for the embed to be ready, gets a token and params from `tokenProvider`, and sends token (and optional params) to the embed. Throws `CodatumEmbedError` on failure.

#### `CodatumEmbedOptions` definition

| Property | Required | Description |
|--------|----------|-------------|
| `container` | Yes | `HTMLElement` or CSS selector where the iframe is inserted |
| `embedUrl` | Yes | Signed embed URL from Codatum |
| `tokenProvider` | Yes | `() => Promise<{ token: string, params?: EncodedParam[] }>`. Called on `init()`, `reload()`, and on token auto-refresh. Returned `params` are sent to the embed with the token. |
| `iframeOptions` | No | See [iframeOptions](#iframeoptions) below |
| `tokenOptions` | No | See [tokenOptions](#tokenoptions) below |
| `displayOptions` | No | See [displayOptions](#displayoptions) below |

#### iframeOptions

Options applied to the iframe element and passed to the embed via URL/search params.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | `'LIGHT'` \| `'DARK'` | Browser's system theme | UI theme of the embedded notebook |
| `locale` | `string` | Browser's locale | Locale code (e.g. `'en'`, `'ja'`) for the embed UI |
| `className` | `string` | - | CSS class name(s) applied to the iframe element |
| `style` | `object` | `{width: '100%', height: '100%', border: 'none'}` | Inline styles for the iframe; overrides the default styles |

#### tokenOptions

Controls token lifetime, refresh behavior, and init timeout.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `refreshBuffer` | `number` | `60` | Seconds before expiry to trigger refresh |
| `retryCount` | `number` | `2` | Number of retries on token fetch failure; `0` = no retry |
| `initTimeout` | `number` | `30000` | Max wait in ms for embed "ready"; `0` = no timeout |
| `onRefreshError` | `(error: Error) => void` | `undefined` | Callback when `tokenProvider` fails after all retries |

#### displayOptions

Sent to the embed with the token.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sqlDisplay` | `'SHOW'` \| `'RESULT_ONLY'` \| `'HIDE'` | `'SHOW'` | Whether to show SQL editor, results only, or hide |
| `hideParamsForm` | `boolean` | `false` | Hide the parameter form in the embed (e.g. when your app owns the filters) |
| `expandParamsFormByDefault` | `boolean` | `false` | Whether the parameter form is expanded by default |

### Instance methods

- **`reload()`** — Calls `tokenProvider` again and sends the returned token and params via `SET_TOKEN`.
- **`on(event, handler)`** / **`off(event, handler)`** — Subscribe to `paramChanged` and `executeSqlsTriggered` (postMessage payloads from the iframe).
- **`destroy()`** — Removes iframe, clears listeners and timers. No-op if already destroyed.

### Instance properties

- **`iframe`** — `HTMLIFrameElement | null`
- **`status`** — `'initializing' | 'ready' | 'destroyed'`

### Errors

All errors are thrown/rejected as `CodatumEmbedError` with `code`:

| Code | When |
|------|------|
| `CONTAINER_NOT_FOUND` | Container element not found at init |
| `INVALID_OPTIONS` | Init options are invalid |
| `INIT_TIMEOUT` | Ready not received within `tokenOptions.initTimeout` |
| `SESSION_PROVIDER_FAILED` | `tokenProvider` threw (init or reload) |

## ParamHelper

Use `CodatumEmbed.createParamHelper(paramDefs)` to map alias names to Codatum `param_id`s (from the admin UI). Use `encode()` to build params to return from `tokenProvider`; use `decode()` for event payloads.

```ts
import { CodatumEmbed } from '@codatum/embed';

const paramHelper = CodatumEmbed.createParamHelper({
  store_id: '67a1b2c3d4e5f6a7b8c9d0e1',
  date_range: '67a1b2c3d4e5f6a7b8c9d0e2',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e3',
});

const embed = await CodatumEmbed.init({
  container: '#dashboard',
  embedUrl: '...',
  tokenProvider: async () => {
    const res = await fetch('/api/session', { method: 'POST' });
    const data = await res.json();
    return {
      token: data.token,
      params: paramHelper.encode(
        {
          store_id: 'store_001',
          date_range: ['2025-01-01', '2025-01-31'],
          product_category: [],
        },
        { hidden: ['store_id'] },
      ),
    };
  },
});

embed.on('paramChanged', (payload) => {
  const values = paramHelper.decode(payload.params);
  // { store_id, date_range, product_category }
});

// Reload: calls tokenProvider again; params come from its return value
await embed.reload();
```

- **`encode(values, options?)`** — Alias + values → `EncodedParam[]`. `options.hidden` marks params as hidden. All keys in `paramDefs` must be provided.
- **`decode(params)`** — `EncodedParam[]` → alias + parsed values. Unknown `param_id`s are ignored.

## Usage examples

### Basic (params form in embed)

```ts
const paramHelper = CodatumEmbed.createParamHelper({
  date_range: '67a1b2c3d4e5f6a7b8c9d0e1',
  product_category: '67a1b2c3d4e5f6a7b8c9d0e2',
  store_id: '67a1b2c3d4e5f6a7b8c9d0e3',
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
      params: paramHelper.encode({
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
  const values = paramHelper.decode(payload.params);
  console.log('Changed:', values);
});
```

### Client-side params only (SaaS manages filters, hide params form)

```ts
let currentStoreId = 'store_001';
let currentDateRange: [string, string] = ['2025-01-01', '2025-01-31'];

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
      params: paramHelper.encode(
        { store_id: currentStoreId, date_range: currentDateRange, product_category: [] },
        { hidden: ['store_id'] },
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
let latestValues = paramHelper.decode([]);

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
      params: paramHelper.encode({
        date_range: '_RESET_TO_DEFAULT_',
        product_category: [],
        store_id: currentStoreId,
      }),
    };
  },
});

embed.on('paramChanged', (payload) => { latestValues = paramHelper.decode(payload.params); });

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
